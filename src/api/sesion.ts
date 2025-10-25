export type Rol = "admin" | "operador";
export type SessionInfo =
  | number                                 // solo id
  | { usuarioId: number | null; rol?: Rol } // objeto
  | null;                                   // sin sesión


export async function sessionInfo(): Promise<SessionInfo> {
  // TODO: implementá la llamada real (IPC/localStorage)
  return null;
}
