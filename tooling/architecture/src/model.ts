export type ArchitectureProfile =
  | 'system'
  | 'foundation'
  | 'orchestration'
  | 'application'
  | 'test-only'
  | 'repository-tooling'
  | 'repository-test';

export type ImportKind = 'import' | 'export' | 'dynamic-import' | 'require';

export interface PackageManifest {
  readonly name?: string;
  readonly private?: boolean;
  readonly exports?: unknown;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
}

export interface DiscoveredPackage {
  readonly name: string;
  readonly root: string;
  readonly relativeRoot: string;
  readonly profile: Exclude<ArchitectureProfile, 'repository-test'>;
  readonly manifest: PackageManifest;
  readonly exportMap: Readonly<Record<string, string>>;
}

export interface SourceImport {
  readonly sourcePath: string;
  readonly specifier: string;
  readonly kind: ImportKind;
  readonly isTypeOnly: boolean;
}

export type ImportResolutionKind = 'package' | 'relative' | 'alias' | 'third-party' | 'unresolved';

export interface ResolvedImport extends SourceImport {
  readonly sourcePackage?: DiscoveredPackage;
  readonly sourceProfile: ArchitectureProfile;
  readonly targetPackage?: DiscoveredPackage;
  readonly targetPath?: string;
  readonly targetSubpath?: string;
  readonly resolutionKind: ImportResolutionKind;
}

export interface DependencyEdge {
  readonly consumer: string;
  readonly provider: string;
  readonly sourcePath: string;
  readonly specifier: string;
  readonly targetSubpath: string;
  readonly isTypeOnly: boolean;
  readonly sourceProfile: ArchitectureProfile;
  readonly targetProfile: ArchitectureProfile;
  readonly resolutionKind: ImportResolutionKind;
}

export interface QueryEdge {
  readonly consumer: string;
  readonly provider: string;
  readonly sourcePath: string;
}

export interface ArchitectureViolation {
  readonly ruleId: string;
  readonly sourcePath: string;
  readonly consumer?: string;
  readonly target?: string;
  readonly targetPath?: string;
  readonly message: string;
  readonly reference: string;
}

export interface ArchitectureReport {
  readonly packages: readonly DiscoveredPackage[];
  readonly edges: readonly DependencyEdge[];
  readonly queryEdges: readonly QueryEdge[];
  readonly violations: readonly ArchitectureViolation[];
}

export interface ApprovedSystemRead {
  readonly consumer: string;
  readonly provider: string;
  readonly reference: string;
}

export interface ArchitecturePolicy {
  readonly approvedSystemReads: readonly ApprovedSystemRead[];
}
