// Accounts that submit listings through the AI listings API (see
// AI_LISTINGS_API.md). The database has no "source" column: a listing was
// created by the AI agent when its user_id is one of these. Add a uuid here
// when another agent account is created.
export const AI_AGENT_USER_IDS = Object.freeze(['a37c425e-4630-4d20-8919-820f3e68a2e7'])

export const isAiAgentUser = (userId) => Boolean(userId) && AI_AGENT_USER_IDS.includes(userId)
