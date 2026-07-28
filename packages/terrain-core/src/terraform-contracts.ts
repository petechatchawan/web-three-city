export type WorldToolMode = 'navigate' | 'raise' | 'lower' | 'flatten';

export type TerraformOperation = Exclude<WorldToolMode, 'navigate'>;

export type TerraformBrushSize = 1 | 3 | 5;
