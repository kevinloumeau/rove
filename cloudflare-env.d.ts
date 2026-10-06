declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    /** Workers AI, for studio photos (app/api/wardrobe/studio). Not available in local dev. */
    AI?: Ai;
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
    /** Local development only: the signed-in user to simulate when Access is not configured. */
    DEV_USER_EMAIL?: string;
  }
}
