import { loadTextPrepConfig } from "../config/env.js";
import { TextPrepAppError } from "../errors.js";
import { AnchorFixApplicator } from "../text/anchorFixApplicator.js";
import { AnchorFixValidator } from "../text/anchorFixValidator.js";
import { BoundaryCandidateBuilder } from "../text/boundaryCandidateBuilder.js";
import { ChunkEditApplicator } from "../text/chunkEditApplicator.js";
import { ChunkEditValidator } from "../text/chunkEditValidator.js";
import { ChunkBuilder } from "../text/chunkBuilder.js";
import { DocumentAssembler } from "../text/documentAssembler.js";
import { flattenDocumentStream } from "../text/documentStreamText.js";
import { LlmBoundarySelector } from "../text/llmBoundarySelector.js";
import {
  LmStudioAnchorFixClient,
  LmStudioAnchorFixError,
  type LmStudioAnchorFixTrace
} from "../text/lmStudioAnchorFixClient.js";
import { LmStudioEditClient } from "../text/lmStudioEditClient.js";
import { LocalTextNormalizer } from "../text/localTextNormalizer.js";
import { LocalChunkPlanner } from "../text/localChunkPlanner.js";
import { OcrTextExtractor } from "../text/ocrTextExtractor.js";
import { OcrTextInputResolver } from "../text/ocrTextInputResolver.js";
import { PageBreakJoiner } from "../text/pageBreakJoiner.js";
import {
  validatePrepareTextOptions,
  type PrepareTextOptions
} from "../text/prepareTextOptions.js";
import { TextRunStore } from "../text/textRunStore.js";
import { logger } from "../utils/logger.js";
import type {
  AnchorFixRejectCode,
  ChunkEditRejectCode,
  LlmCallLog,
  TextChunk,
  TextPrepConfig,
  TextPrepError,
  TextPrepErrorCode
} from "../types.js";

type RunPrepareTextDeps = {
  config?: TextPrepConfig;
  fetchImpl?: typeof fetch;
};

export async function runPrepareText(
  options: PrepareTextOptions,
  deps: RunPrepareTextDeps = {}
): Promise<void> {
  validatePrepareTextOptions(options);

  const config = deps.config ?? loadTextPrepConfig();
  const resolver = new OcrTextInputResolver();
  const inputs = options.ocrRunId
    ? await resolver.resolveByOcrRunId(options.ocrRunId, options.pages)
    : await resolver.resolveByOcrJson(options.ocrJson!);

  if (inputs.length === 0) {
    throw new TextPrepAppError(
      "INPUT_OCR_NOT_FOUND",
      "No OCR JSON files matched the prepare-text input options."
    );
  }

  const store = new TextRunStore(config, options.ocrRunId);
  await store.createRun();

  const extractor = new OcrTextExtractor();
  const normalizer = new LocalTextNormalizer();
  const assembler = new DocumentAssembler();
  const pageBreakJoiner = new PageBreakJoiner();
  const boundaryBuilder = new BoundaryCandidateBuilder();
  const localChunkPlanner = new LocalChunkPlanner(
    config.textChunkMaxChars,
    config.textChunkMinChars
  );
  const chunkBuilder = new ChunkBuilder();
  const boundarySelector = new LlmBoundarySelector(config, deps.fetchImpl);
  const lmStudioClient = new LmStudioEditClient(config, deps.fetchImpl);
  const editValidator = new ChunkEditValidator(config.llmMaxEditRatio);
  const editApplicator = new ChunkEditApplicator(config.textChunkMaxChars);
  const anchorFixClient = new LmStudioAnchorFixClient(config, deps.fetchImpl);
  const anchorFixValidator = new AnchorFixValidator({
    maxFixesPerChunk: config.llmMaxFixesPerChunk,
    maxAnchorChars: config.llmMaxAnchorChars,
    maxFixRatio: config.llmMaxFixRatio
  });
  const anchorFixApplicator = new AnchorFixApplicator(config.textChunkMaxChars);
  const pages: Array<{
    index: number;
    sourceJsonPath: string;
    rawText: string;
    normalizedText: string;
    elapsedMs: number;
  }> = [];

  for (const input of inputs) {
    const startedAt = Date.now();
    const rawText = await extractor.extract(input.sourceJsonPath);
    const normalizedText = normalizer.normalize(rawText);

    pages.push({
      index: input.index,
      sourceJsonPath: input.sourceJsonPath,
      rawText,
      normalizedText,
      elapsedMs: Date.now() - startedAt
    });
  }

  const assembledStream = assembler.assemble({
    runId: store.getRunId(),
    pages: pages.map((page) => ({ index: page.index, text: page.normalizedText })),
    excludeToc: options.excludeToc
  });
  const skippedPageMap = new Map(
    assembledStream.skippedPages.map((page) => [page.pageIndex, page.reason])
  );

  for (const page of pages) {
    const skipReason = skippedPageMap.get(page.index);
    if (!skipReason) {
      continue;
    }

    if (skipReason === "EMPTY") {
      await store.appendError(
        toTextPrepError(
          new TextPrepAppError(
            "EMPTY_TEXT_INPUT",
            "OCR JSON did not contain usable text.",
            page.index
          )
        )
      );
      logger.warn({ pageIndex: page.index }, "Text input was empty.");
    }

    await store.writePageFiles({
      index: page.index,
      sourceJsonPath: page.sourceJsonPath,
      rawText: page.rawText,
      normalizedText: page.normalizedText,
      correctedText: "",
      usedLlm: false,
      elapsedMs: page.elapsedMs,
      skipReason: skipReason === "TOC" ? "TOC" : undefined
    });

    if (skipReason === "TOC") {
      logger.info({ pageIndex: page.index }, "Skipped table of contents page.");
    }
  }

  const stream = config.textPageBreakJoin
    ? pageBreakJoiner.join(assembledStream)
    : assembledStream;
  const pageBreakJoinCount = stream.segments.filter(
    (segment) => segment.kind === "page_break" && segment.joined
  ).length;
  const boundaries = boundaryBuilder.build(stream);
  const localChunks = localChunkPlanner.plan(stream, boundaries);
  let allChunks = localChunks;
  let boundaryFallbackReason: TextPrepErrorCode | undefined;
  let selectedBoundaryIds = localChunks
    .map((chunk) => chunk.boundaryEndId)
    .filter(
      (id): id is string =>
        typeof id === "string" && !id.startsWith("hard-") && id !== "end"
    );
  let selectionMode: "local" | "llm" = "local";

  if (
    config.llmEnabled &&
    config.textEnableLlmBoundary &&
    config.textSplitMode === "llm" &&
    boundaries.length > 0
  ) {
    try {
      selectedBoundaryIds = await boundarySelector.select({
        context: flattenDocumentStream(stream).text.slice(0, 4000),
        boundaries
      });
      const llmChunks = chunkBuilder.build(stream, boundaries, selectedBoundaryIds, "llm");
      if (
        llmChunks.length > 0 &&
        llmChunks.every((chunk) => chunk.charLength <= config.textChunkMaxChars)
      ) {
        allChunks = llmChunks;
        selectionMode = "llm";
      } else {
        boundaryFallbackReason = "BOUNDARY_SELECTION_FAILED";
        await store.appendError(
          toTextPrepError(
            new TextPrepAppError(
              "BOUNDARY_SELECTION_FAILED",
              "LLM boundary selection did not produce valid chunks under the max length."
            )
          )
        );
      }
    } catch (error) {
      boundaryFallbackReason = "LLM_RESPONSE_INVALID";
      await store.appendError(
        toTextPrepError(
          new TextPrepAppError(
            "LLM_RESPONSE_INVALID",
            error instanceof Error ? error.message : String(error)
          )
        )
      );
      logger.warn(
        { code: "LLM_RESPONSE_INVALID" },
        "LLM boundary selection failed; using local chunk plan."
      );
    }
  }

  const correctedChunks: TextChunk[] = [];
  for (const chunk of allChunks) {
    correctedChunks.push(
      options.ocrCorrection === false
        ? withCorrection(chunk, false, 0, [], undefined, config.llmCorrectionMode)
        : config.llmCorrectionMode === "anchor"
          ? await correctAnchorChunkWithFallback({
              client: anchorFixClient,
              validator: anchorFixValidator,
              applicator: anchorFixApplicator,
              config,
              chunk,
              store
            })
          : await correctEditChunkWithFallback({
              client: lmStudioClient,
              validator: editValidator,
              applicator: editApplicator,
              config,
              chunk,
              store
            })
    );
  }

  for (const page of pages) {
    if (skippedPageMap.has(page.index)) {
      continue;
    }

    const pageChunks = correctedChunks.filter((chunk) =>
      (chunk.sourcePageIndexes ?? [chunk.pageIndex]).includes(page.index)
    );
    const correctedText = pageChunks.map((chunk) => chunk.text).join("");
    const usedLlm = pageChunks.some((chunk) => chunk.correction?.usedLlm);

    if (!page.normalizedText) {
      continue;
    }

    await store.writePageFiles({
      index: page.index,
      sourceJsonPath: page.sourceJsonPath,
      rawText: page.rawText,
      normalizedText: page.normalizedText,
      correctedText,
      usedLlm,
      elapsedMs: page.elapsedMs
    });
    logger.info(
      {
        pageIndex: page.index,
        rawTextLength: page.rawText.length,
        correctedTextLength: correctedText.length,
        chunkCount: pageChunks.length,
        usedLlm
      },
      "Prepared text page."
    );
  }

  await store.updateMetadata({
    splitMode: config.textSplitMode,
    pageBreakJoin: config.textPageBreakJoin,
    textChunkMaxChars: config.textChunkMaxChars,
    llmBoundaryEnabled: config.textEnableLlmBoundary,
    llmDebugSaveResponses: config.llmDebugSaveResponses,
    skippedPages: assembledStream.skippedPages,
    pageBreakJoinCount,
    boundarySelection: {
      mode: selectionMode,
      boundaryCount: boundaries.length,
      selectedBoundaryIds,
      ...(boundaryFallbackReason ? { fallbackReason: boundaryFallbackReason } : {})
    }
  });
  await store.writeChunks(correctedChunks);
  await store.completeRun();
  logger.info(
    {
      runId: store.getRunId(),
      metadataPath: store.getMetadataPath(),
      chunksPath: store.getChunksPath(),
      chunkCount: allChunks.length
    },
    "Text preparation completed."
  );
}

type CorrectChunkDeps = {
  client: LmStudioEditClient;
  validator: ChunkEditValidator;
  applicator: ChunkEditApplicator;
  config: TextPrepConfig;
  chunk: TextChunk;
  store: TextRunStore;
};

type CorrectAnchorChunkDeps = {
  client: LmStudioAnchorFixClient;
  validator: AnchorFixValidator;
  applicator: AnchorFixApplicator;
  config: TextPrepConfig;
  chunk: TextChunk;
  store: TextRunStore;
};

async function correctAnchorChunkWithFallback({
  client,
  validator,
  applicator,
  config,
  chunk,
  store
}: CorrectAnchorChunkDeps): Promise<TextChunk> {
  if (!config.llmEnabled) {
    return withCorrection(chunk, false, 0, [], undefined, "anchor");
  }

  try {
    logger.info(
      {
        pageIndex: chunk.pageIndex,
        chunkId: chunk.id,
        textLength: chunk.text.length,
        mode: "anchor"
      },
      "LM Studio OCR fix request started."
    );
    const result = await client.proposeFixesWithTrace(chunk);
    const fixes = result.fixes;
    const validation = validator.validate(chunk.text, fixes);
    if (validation.rejected.length > 0) {
      await store.appendError(
        toTextPrepError(
          new TextPrepAppError(
            "LLM_EDIT_REJECTED",
            `Rejected ${validation.rejected.length} unsafe fix(es) for ${chunk.id}.`,
            chunk.pageIndex
          ),
          chunk.id
        )
      );
    }

    const applied = applicator.apply(chunk.text, validation.accepted);
    if (applied.fallbackReason) {
      await store.appendError(
        toTextPrepError(
          new TextPrepAppError(
            "LLM_RESPONSE_INVALID",
            `Rejected fix result for ${chunk.id}: ${applied.fallbackReason}.`,
            chunk.pageIndex
          ),
          chunk.id
        )
      );
      await recordLlmCall({
        store,
        config,
        chunk,
        trace: result.trace,
        acceptedCount: validation.accepted.length,
        rejectedCount: validation.rejected.length,
        fallbackReason: "LLM_RESPONSE_INVALID"
      });
      return withCorrection(
        chunk,
        true,
        validation.accepted.length,
        validation.rejected.map((rejection) => rejection.code),
        "LLM_RESPONSE_INVALID",
        "anchor"
      );
    }

    await recordLlmCall({
      store,
      config,
      chunk,
      trace: result.trace,
      acceptedCount: validation.accepted.length,
      rejectedCount: validation.rejected.length,
      fallbackReason:
        validation.accepted.length === 0 && validation.rejected.length > 0
          ? "LLM_EDIT_REJECTED"
          : undefined
    });

    return withCorrection(
      {
        ...chunk,
        text: applied.text,
        charLength: applied.text.length
      },
      true,
      validation.accepted.length,
      validation.rejected.map((rejection) => rejection.code),
      validation.accepted.length === 0 && validation.rejected.length > 0
        ? "LLM_EDIT_REJECTED"
        : undefined,
      "anchor"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code: TextPrepErrorCode = message.includes("LLM_RESPONSE_INVALID")
      || message.includes("message content")
      || message.includes("schema")
      || message.includes("JSON")
      ? "LLM_RESPONSE_INVALID"
      : "LLM_REQUEST_FAILED";
    if (error instanceof LmStudioAnchorFixError) {
      await recordLlmCall({
        store,
        config,
        chunk,
        trace: error.trace,
        acceptedCount: 0,
        rejectedCount: 0,
        fallbackReason: code,
        errorCode: code,
        errorMessage: message
      });
    }
    await store.appendError(
      toTextPrepError(new TextPrepAppError(code, message, chunk.pageIndex), chunk.id)
    );
    logger.warn(
      { pageIndex: chunk.pageIndex, chunkId: chunk.id, code },
      "LM Studio anchor fix correction failed; using local chunk."
    );
    return withCorrection(chunk, false, 0, [], code, "anchor");
  }
}

async function correctEditChunkWithFallback({
  client,
  validator,
  applicator,
  config,
  chunk,
  store
}: CorrectChunkDeps): Promise<TextChunk> {
  if (!config.llmEnabled) {
    return withCorrection(chunk, false, 0, [], undefined, "edits");
  }

  try {
    const edits = await client.proposeEdits(chunk);
    const validation = validator.validate(chunk.text, edits);
    if (validation.rejected.length > 0) {
      await store.appendError(
        toTextPrepError(
          new TextPrepAppError(
            "LLM_EDIT_REJECTED",
            `Rejected ${validation.rejected.length} unsafe edit(s) for ${chunk.id}.`,
            chunk.pageIndex
          ),
          chunk.id
        )
      );
    }

    const applied = applicator.apply(chunk.text, validation.accepted);
    if (applied.fallbackReason) {
      await store.appendError(
        toTextPrepError(
          new TextPrepAppError(
            "LLM_RESPONSE_INVALID",
            `Rejected edit result for ${chunk.id}: ${applied.fallbackReason}.`,
            chunk.pageIndex
          ),
          chunk.id
        )
      );
      return withCorrection(
        chunk,
        true,
        validation.accepted.length,
        validation.rejected.map((rejection) => rejection.code),
        "LLM_RESPONSE_INVALID",
        "edits"
      );
    }

    return withCorrection(
      {
        ...chunk,
        text: applied.text,
        charLength: applied.text.length
      },
      true,
      validation.accepted.length,
      validation.rejected.map((rejection) => rejection.code),
      validation.accepted.length === 0 && validation.rejected.length > 0
        ? "LLM_EDIT_REJECTED"
        : undefined,
      "edits"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code: TextPrepErrorCode = message.includes("LLM_RESPONSE_INVALID")
      || message.includes("message content")
      || message.includes("schema")
      || message.includes("JSON")
      ? "LLM_RESPONSE_INVALID"
      : "LLM_REQUEST_FAILED";
    await store.appendError(
      toTextPrepError(new TextPrepAppError(code, message, chunk.pageIndex), chunk.id)
    );
    logger.warn(
      { pageIndex: chunk.pageIndex, chunkId: chunk.id, code },
      "LM Studio edit correction failed; using local chunk."
    );
    return withCorrection(chunk, false, 0, [], code, "edits");
  }
}

function withCorrection(
  chunk: TextChunk,
  usedLlm: boolean,
  acceptedCount: number,
  rejectedReasons: Array<ChunkEditRejectCode | AnchorFixRejectCode>,
  fallbackReason: TextPrepErrorCode | undefined,
  mode: "edits" | "anchor"
): TextChunk {
  return {
    ...chunk,
    correction: {
      usedLlm,
      acceptedEditCount: acceptedCount,
      rejectedEditCount: rejectedReasons.length,
      ...(fallbackReason ? { fallbackReason } : {}),
      ...(rejectedReasons.length > 0 ? { rejectReasons: rejectedReasons } : {}),
      mode
    }
  };
}

async function recordLlmCall({
  store,
  config,
  chunk,
  trace,
  acceptedCount,
  rejectedCount,
  fallbackReason,
  errorCode,
  errorMessage
}: {
  store: TextRunStore;
  config: TextPrepConfig;
  chunk: TextChunk;
  trace: LmStudioAnchorFixTrace;
  acceptedCount: number;
  rejectedCount: number;
  fallbackReason?: TextPrepErrorCode;
  errorCode?: TextPrepErrorCode;
  errorMessage?: string;
}): Promise<void> {
  const callId = `${chunk.id}-${trace.startedAt.replace(/[:.]/g, "-")}`;
  const debugPath = config.llmDebugSaveResponses
    ? await store.writeLlmDebugArtifact(callId, {
        chunk: {
          id: chunk.id,
          pageIndex: chunk.pageIndex,
          textLength: chunk.text.length
        },
        request: trace.request,
        response: trace.response,
        rawResponseBody: trace.rawResponseBody,
        content: trace.content,
        reasoningContent: trace.reasoningContent,
        transportError: trace.transportError
      })
    : undefined;
  const call: LlmCallLog = {
    id: callId,
    provider: "lmstudio",
    purpose: "ocr_fix",
    mode: "anchor",
    chunkId: chunk.id,
    pageIndex: chunk.pageIndex,
    textLength: chunk.text.length,
    startedAt: trace.startedAt,
    completedAt: trace.completedAt,
    elapsedMs: trace.elapsedMs,
    status: trace.status,
    ok: trace.ok,
    model: trace.model ?? config.llmModel,
    finishReason: trace.finishReason,
    promptTokens: trace.promptTokens,
    completionTokens: trace.completionTokens,
    reasoningTokens: trace.reasoningTokens,
    totalTokens: trace.totalTokens,
    contentLength: trace.content?.length ?? 0,
    reasoningContentLength: trace.reasoningContent?.length ?? 0,
    transportError: trace.transportError,
    acceptedEditCount: acceptedCount,
    rejectedEditCount: rejectedCount,
    fallbackReason,
    errorCode,
    errorMessage,
    debugPath
  };

  await store.appendLlmCall(call);
  logger.info(
    {
      pageIndex: chunk.pageIndex,
      chunkId: chunk.id,
      elapsedMs: call.elapsedMs,
      status: call.status,
      finishReason: call.finishReason,
      contentLength: call.contentLength,
      reasoningContentLength: call.reasoningContentLength,
      transportError: call.transportError,
      acceptedEditCount: acceptedCount,
      rejectedEditCount: rejectedCount,
      fallbackReason,
      errorCode,
      debugPath
    },
    "LM Studio OCR fix request completed."
  );
}

function toTextPrepError(error: TextPrepAppError, chunkId?: string): TextPrepError {
  return {
    code: error.code,
    message: error.message,
    pageIndex: error.pageIndex,
    chunkId,
    occurredAt: new Date().toISOString()
  };
}
