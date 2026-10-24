const userAgent = process.env.SEC_USER_AGENT
if (!userAgent) {
    throw new Error('SEC_USER_AGENT is required (see .env.example)')
}

export const config = {
    port: Number(process.env.PORT ?? 3000),
    secUserAgent: userAgent,
}