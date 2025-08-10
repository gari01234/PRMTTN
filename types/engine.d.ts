// ./types/engine.d.ts
export interface Engine {
  /** Identificador único del motor, p.ej. 'FRBN', 'LCHT', 'OFFNNG', 'TMSL', 'BUILD' */
  id: string;

  /** Entrar al motor (debe dejarlo visible/activo). Debe ser idempotente. */
  enter(host?: unknown): Promise<void> | void;

  /** Salir del motor (ocultarlo y liberar recursos transitorios). Idempotente. */
  exit(): Promise<void> | void;

  /** Sincroniza el motor con el estado de escena actual (perms, mapping, seeds…). */
  syncFromScene?(): void;

  /** Liberación definitiva (geometrías, materiales, listeners). */
  dispose?(): void;

  /** Opcional: sugerencias para UI/controles al estar activo. */
  controlsVisibility?(opts: { cube?: boolean; perms?: boolean; ui?: boolean }): void;
}

export interface EngineRegistry {
  register(engine: Engine): void;
  enter(id: string): Promise<boolean>;
  cycle(): Promise<boolean>;
  ids(): string[];
  get(id: string): Engine | undefined;
  active(): string | null;
}

// Exposición global en runtime del navegador
declare global {
  var ENGINE: EngineRegistry;
}
