export interface Config { enabled: boolean; syntheticOnly: boolean; targetId: string; expiresAt: number }
export interface Store { findDevice(hash: string): Promise<{guestId: string; targetId: string; expiresAt: number; revoked: boolean} | null>; consumeInvitationAndCreateDevice(input: {invitationHash:string;tokenHash:string;guestId:string;targetId:string;now:number;expiresAt:number}):Promise<boolean> }
export function allowedConfig(config: Config, now: number): boolean;
export function authenticate(header: string | null, options: { store: Store; config: Config; now?: number }): Promise<{ guestId: string; expiresAt: number } | null>;
export function enroll(code: unknown, options: { store: Store; config: Config; now?: number }): Promise<{ token: string; expiresAt: number } | null>;
