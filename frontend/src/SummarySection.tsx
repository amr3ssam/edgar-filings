import { useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Autocomplete,
    Card,
    CardContent,
    LinearProgress,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import { fetchSummary, normalizeTicker, type SummaryResponse } from './api'

const topFormCount = 5

type Props = {
    tickers: string[]
    onTickersChange: (tickers: string[]) => void
    selected: string
    onSelect: (ticker: string) => void
}

type Result = { key: string; data?: SummaryResponse; error?: string }

export function SummarySection({ tickers, onTickersChange, selected, onSelect }: Props) {
    const [result, setResult] = useState<Result>()
    const tickersKey = tickers.join(',')

    useEffect(() => {
        const controller = new AbortController()
        fetchSummary(tickersKey.split(','), controller.signal)
            .then((data) => setResult({ key: tickersKey, data }))
            .catch((err: Error) => {
                if (!controller.signal.aborted) setResult({ key: tickersKey, error: err.message })
            })
        return () => controller.abort()
    }, [tickersKey])

    const loading = result?.key !== tickersKey
    const data = result?.data
    const error = result?.error

    const topForms = useMemo(() => {
        const totals: Record<string, number> = {}
        const companiesWith: Record<string, number> = {}
        for (const company of data?.companies ?? []) {
            if ('error' in company) continue
            for (const [form, count] of Object.entries(company.countsByForm)) {
                totals[form] = (totals[form] ?? 0) + count
                companiesWith[form] = (companiesWith[form] ?? 0) + 1
            }
        }
        return Object.keys(totals)
            .sort((a, b) => (companiesWith[b] ?? 0) - (companiesWith[a] ?? 0) || (totals[b] ?? 0) - (totals[a] ?? 0))
            .slice(0, topFormCount)
    }, [data])

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={2}>
                    <div>
                        <Typography variant="h6" component="h2">
                            Filings in the last 12 months
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {data ? `Since ${data.since}. ` : ''}Select a company to see its filings below.
                        </Typography>
                    </div>

                    <Autocomplete
                        multiple
                        freeSolo
                        size="small"
                        options={[]}
                        value={tickers}
                        onChange={(_, value) => onTickersChange([...new Set(value.map(normalizeTicker).filter(Boolean))])}
                        renderInput={(params) => <TextField {...params} label="Companies" placeholder="Add a ticker and press Enter" />}
                    />

                    {loading && <LinearProgress />}
                    {error && <Alert severity="error">{error}</Alert>}

                    {data && data.companies.length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                            Add a ticker to compare companies.
                        </Typography>
                    )}

                    {data && data.companies.length > 0 && (
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Company</TableCell>
                                        {topForms.map((form) => (
                                            <TableCell key={form} align="right">
                                                {form}
                                            </TableCell>
                                        ))}
                                        <TableCell align="right">Other</TableCell>
                                        <TableCell align="right">Total</TableCell>
                                        <TableCell>Latest 10-K</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data.companies.map((company) => {
                                        if ('error' in company) {
                                            return (
                                                <TableRow key={company.ticker}>
                                                    <TableCell>
                                                        <b>{company.ticker}</b>
                                                    </TableCell>
                                                    <TableCell colSpan={topForms.length + 3}>
                                                        <Typography variant="body2" color="error">
                                                            {company.error}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        }

                                        const total = Object.values(company.countsByForm).reduce((a, b) => a + b, 0)
                                        const inTop = topForms.reduce((sum, form) => sum + (company.countsByForm[form] ?? 0), 0)

                                        return (
                                            <TableRow
                                                key={company.ticker}
                                                hover
                                                selected={company.ticker === selected}
                                                onClick={() => onSelect(company.ticker)}
                                                sx={{ cursor: 'pointer' }}
                                            >
                                                <TableCell>
                                                    <b>{company.ticker}</b>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                        {company.name}
                                                    </Typography>
                                                </TableCell>
                                                {topForms.map((form) => (
                                                    <TableCell key={form} align="right">
                                                        {company.countsByForm[form] ?? 0}
                                                    </TableCell>
                                                ))}
                                                <TableCell align="right">{total - inTop}</TableCell>
                                                <TableCell align="right">{total}</TableCell>
                                                <TableCell>
                                                    {company.latest10K ?? (
                                                        <Tooltip title="No 10-K in recent filings. Foreign companies file a 20-F or 40-F instead.">
                                                            <span>None</span>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Stack>
            </CardContent>
        </Card>
    )
}