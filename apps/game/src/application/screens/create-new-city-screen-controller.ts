import type {
  CitySessionFailureCode,
  CitySessionService,
  LiveCitySession,
  NewCityPreview,
} from "@web-three-city/orchestration-city-session";
import type { RegionId } from "@web-three-city/world";
import type {
  NewCityTerrainPreviewFactory,
  NewCityTerrainPreviewHandle,
} from "../../presentation/preview/create-new-city-terrain-preview";
import {
  createNewCityView,
  type NewCityView,
} from "../../ui/screens/new-city/create-new-city-view";
import type {
  NewCityIntent,
  NewCityViewState,
} from "../../ui/screens/new-city/new-city-view-state";
import type { ScreenController } from "../navigation/screen-controller";

export interface NewCityScreenController extends ScreenController {
  state(): NewCityViewState;
  intent(intent: NewCityIntent): Promise<void>;
}

export function createNewCityScreenController(input: {
  readonly service: Pick<
    CitySessionService,
    "prepareNewCity" | "createNewCity"
  >;
  readonly initialSeed64: string;
  readonly randomSeed64: () => string;
  readonly formatError: (code: CitySessionFailureCode) => string;
  readonly previewFactory: NewCityTerrainPreviewFactory;
  readonly createView?: (input: {
    readonly onIntent: (intent: NewCityIntent) => void;
  }) => NewCityView;
  readonly onBack: () => void;
  readonly onCreateSuccess: (session: LiveCitySession) => void;
}): NewCityScreenController {
  let disposed = false;
  let previewHandle: NewCityTerrainPreviewHandle | undefined;
  let state: NewCityViewState = {
    name: "",
    seed64: input.initialSeed64,
    phase: "configuring",
    previewFresh: false,
  };

  const view = (input.createView ?? createNewCityView)({
    onIntent: (intent) => void handleIntent(intent),
  });

  const render = (): void => {
    view.render(state);
    previewHandle?.setSelectedRegion(state.selectedRegionId);
    view.previewMount.dataset.previewCanvasCount = String(
      view.previewMount.querySelectorAll("canvas").length,
    );
  };

  const replacePreviewPresentation = (preview: NewCityPreview): void => {
    previewHandle?.dispose();
    previewHandle = input.previewFactory.create({
      mount: view.previewMount,
      preview,
      onSelectRegion: (regionId) =>
        void handleIntent({ type: "select-region", regionId }),
    });
    view.previewMount.dataset.previewRuntime =
      previewHandle === undefined ? "unavailable" : "ready";
    view.previewMount.dataset.previewCanvasCount = String(
      view.previewMount.querySelectorAll("canvas").length,
    );
  };

  const configuringState = (next: {
    readonly name?: string;
    readonly seed64?: string;
  }): NewCityViewState => ({
    name: next.name ?? state.name,
    seed64: next.seed64 ?? state.seed64,
    phase: "configuring",
    ...(state.preview === undefined ? {} : { preview: state.preview }),
    previewFresh: false,
    ...(state.selectedRegionId === undefined
      ? {}
      : { selectedRegionId: state.selectedRegionId }),
  });

  async function generate(): Promise<void> {
    if (disposed || state.phase === "generating" || state.phase === "creating")
      return;
    state = {
      name: state.name,
      seed64: state.seed64,
      phase: "generating",
      ...(state.preview === undefined ? {} : { preview: state.preview }),
      previewFresh: false,
      ...(state.selectedRegionId === undefined
        ? {}
        : { selectedRegionId: state.selectedRegionId }),
    };
    render();
    const result = input.service.prepareNewCity({
      name: state.name.trim(),
      seed64: state.seed64.trim(),
    });
    if (disposed) return;
    if (result.status !== "success") {
      state = {
        name: state.name,
        seed64: state.seed64,
        phase: "configuring",
        previewFresh: false,
        error: input.formatError(result.code),
      };
      previewHandle?.dispose();
      previewHandle = undefined;
      view.previewMount.dataset.previewRuntime = "idle";
      view.previewMount.dataset.previewCanvasCount = "0";
      render();
      return;
    }
    state = {
      name: result.value.name,
      seed64: result.value.seed64,
      phase: "preview-ready",
      preview: result.value,
      previewFresh: true,
    };
    render();
    replacePreviewPresentation(result.value);
  }

  async function create(): Promise<void> {
    if (
      disposed ||
      state.phase !== "preview-ready" ||
      !state.previewFresh ||
      state.preview === undefined ||
      state.selectedRegionId === undefined
    ) {
      return;
    }
    const preview = state.preview;
    const selectedRegionId: RegionId = state.selectedRegionId;
    state = { ...state, phase: "creating" };
    render();
    const result = await input.service.createNewCity({
      preview,
      selectedStartingRegionId: selectedRegionId,
    });
    if (disposed) return;
    if (result.status !== "success") {
      state = {
        ...state,
        phase: "preview-ready",
        error: input.formatError(result.code),
      };
      render();
      return;
    }
    input.onCreateSuccess(result.value);
  }

  async function handleIntent(intent: NewCityIntent): Promise<void> {
    if (disposed) return;
    switch (intent.type) {
      case "back":
        input.onBack();
        return;
      case "name-changed":
        state = configuringState({ name: intent.value });
        render();
        return;
      case "seed-changed":
        state = configuringState({ seed64: intent.value });
        render();
        return;
      case "randomize-seed":
        state = configuringState({ seed64: input.randomSeed64() });
        render();
        return;
      case "generate":
        await generate();
        return;
      case "select-region":
        if (
          state.preview === undefined ||
          !state.previewFresh ||
          !state.preview.eligibleStartingRegionIds.includes(intent.regionId)
        ) {
          return;
        }
        state = { ...state, selectedRegionId: intent.regionId };
        render();
        return;
      case "create":
        await create();
    }
  }

  render();
  return Object.freeze({
    element: view.element,
    state: () => state,
    intent: handleIntent,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      previewHandle?.dispose();
      previewHandle = undefined;
      view.previewMount.dataset.previewRuntime = "disposed";
      view.previewMount.dataset.previewCanvasCount = "0";
      view.dispose();
    },
  });
}
