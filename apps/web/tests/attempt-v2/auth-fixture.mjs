// Authenticated-session fixture ONLY, not OIDC/session cryptography proof.
let session=null;
export function setFixtureSession(value){session=value;}
export async function auth(){return session;}
