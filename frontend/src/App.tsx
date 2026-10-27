import { useState } from 'react'
import { Container, Stack, Typography } from '@mui/material'
import { FilingsSection } from './FilingsSection'
import { SummarySection } from './SummarySection'

export default function App() {
  const [summaryTickers, setSummaryTickers] = useState(['AAPL', 'SPOT', 'JPM'])
  const [ticker, setTicker] = useState('AAPL')

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1">
          EDGAR Filings
        </Typography>
        <SummarySection
          tickers={summaryTickers}
          onTickersChange={setSummaryTickers}
          selected={ticker}
          onSelect={setTicker}
        />
        <FilingsSection key={ticker} ticker={ticker} onTickerChange={setTicker} />
      </Stack>
    </Container>
  )
}