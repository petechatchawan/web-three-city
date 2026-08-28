export type PackageProfile =
  | "system"
  | "foundation"
  | "orchestration"
  | "app"
  | "testkit"
  | "tooling"
  | "unknown";

export type SourceKind = "production" | "package-test" | "repository-test";

export interface WorkspacePackage {
  readonly name: string;
  readonly root: string;
  readonly relativeRoot: string;
  readonly profile: PackageProfile;
  readonly exports: Readonly<Record<string, string>>;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly optionalDependencies: Readonly<Record<string, string>>;
}

export interface SourceImport {
  readonly sourceFile: string;
  readonly sourceKind: SourceKind;
  readonly sourcePackageName?: string;
  readonly specifier: string;
  readonly targetPackageName?: string;
  readonly targetSurface?: string;
  readonly resolvedPath?: string;
  readonly relativeCrossPackage: boolean;
}

export interface BrowserGlobalReference {
  readonly sourceFile: string;
  readonly sourcePackageName: string;
  readonly name: string;
}

export interface SourceAnalysis {
  readonly imports: readonly SourceImport[];
  readonly browserGlobals: readonly BrowserGlobalReference[];
}

export interface ArchitectureEdge {
  readonly from: string;
  readonly to: string;
  readonly surface: string;
  readonly kind: SourceKind;
  readonly sourceFile: string;
}

export interface ArchitectureViolation {
  readonly ruleId: string;
  readonly source: string;
  readonly target?: string;
  readonly message: string;
  readonly reference: string;
}

export interface ArchitectureReport {
  readonly packages: readonly {
    readonly name: string;
    readonly path: string;
    readonly profile: PackageProfile;
  }[];
  readonly edges: readonly ArchitectureEdge[];
  readonly violations: readonly ArchitectureViolation[];
}

export interface ApprovedEdge {
  readonly from: string;
  readonly to: string;
  readonly reference: string;
}

export interface PackageNameDeviation {
  readonly path: string;
  readonly name: string;
  readonly reference: string;
}

export interface AlternateInternalLayout {
  readonly package: string;
  readonly mapping: Readonly<Record<string, string>>;
  readonly reference: string;
}

export interface ArchitecturePolicy {
  readonly version: 1;
  readonly approvedSystemReadEdges: readonly ApprovedEdge[];
  readonly approvedSameLayerEdges: readonly ApprovedEdge[];
  readonly packageNameDeviations: readonly PackageNameDeviation[];
  readonly alternateInternalLayouts: readonly AlternateInternalLayout[];
}
