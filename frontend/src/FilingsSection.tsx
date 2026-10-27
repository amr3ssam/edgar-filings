import { useEffect, useState } from 'react'
import {
    Alert,
    Card,
    CardContent,
    Chip,
    LinearProgress,
    Link,
    MenuItem,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TableSortLabel,
    TextField,
    Typography,
} from '@mui/material'
import { fetchFilings, normalizeTicker, type FilingsResponse } from './api'

type Props = {
    ticker: string
    onTickerChange: (ticker: string) => void
}

type Result = { key: string; data?: FilingsResponse; error?: string }

export function FilingsSection({ ticker, onTickerChange }: Props) {
    const [tickerInput, setTickerInput] = useState(ticker)
    const [form, setForm] = useState('')
    const [sort, setSort] = useState<'asc' | 'desc'>('desc')
    const [page, setPage] = useState(0)
    const [pageSize, setPageSize] = useState(25)
    const [result, setResult] = useState<Result>()
    const requestKey = JSON.stringify({ ticker, form, sort, page, pageSize })

    useEffect(() => {
        const controller = new AbortController()
        fetchFilings({ ticker, form, sort, page: page + 1, pageSize }, controller.signal)
            .then((data) => setResult({ key: requestKey, data }))
            .catch((err: Error) => {
                if (!controller.signal.aborted) setResult({ key: requestKey, error: err.message })
            })
        return () => controller.abort()
    }, [requestKey, ticker, form, sort, page, pageSize])

    const loading = result?.key !== requestKey
    const data = result?.data
    const error = result?.error

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={2}>
                    <div>
                        <Typography variant="h6" component="h2">
                            {data ? `${data.company.name} filings` : 'Filings'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {data ? `CIK ${data.company.cik}` : '\u00a0'}
                        </Typography>
                    </div>

                    <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <form
                            onSubmit={(event) => {
                                event.preventDefault()
                                const next = normalizeTicker(tickerInput)
                                if (next) onTickerChange(next)
                            }}
                        >
                            <TextField
                                size="small"
                                label="Ticker"
                                helperText="Press Enter"
                                value={tickerInput}
                                onChange={(event) => setTickerInput(event.target.value)}
                                sx={{ width: 140 }}
                            />
                        </form>

                        <TextField
                            select
                            size="small"
                            label="Form type"
                            value={form}
                            disabled={!data}
                            onChange={(event) => {
                                setForm(event.target.value)
                                setPage(0)
                            }}
                            sx={{ width: 220 }}
                        >
                            <MenuItem value="">All forms</MenuItem>
                            {data?.availableForms.map((f) => (
                                <MenuItem key={f.form} value={f.form}>
                                    {f.form} ({f.count})
                                </MenuItem>
                            ))}
                        </TextField>
                    </Stack>

                    {error && <Alert severity="error">{error}</Alert>}
                    {loading && <LinearProgress />}

                    {data && (
                        <>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sortDirection={sort}>
                                                <TableSortLabel
                                                    active
                                                    direction={sort}
                                                    onClick={() => {
                                                        setSort(sort === 'desc' ? 'asc' : 'desc')
                                                        setPage(0)
                                                    }}
                                                >
                                                    Filing date
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>Form</TableCell>
                                            <TableCell>Document</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data.filings.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={3}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        No filings match this form type.
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {data.filings.map((filing) => (
                                            <TableRow key={filing.accessionNumber} hover>
                                                <TableCell>{filing.filingDate}</TableCell>
                                                <TableCell>
                                                    <Chip label={filing.form} size="small" variant="outlined" />
                                                </TableCell>
                                                <TableCell>
                                                    <Link href={filing.documentUrl} target="_blank" rel="noopener noreferrer">
                                                        Open on sec.gov
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <TablePagination
                                component="div"
                                count={data.pagination.total}
                                page={page}
                                rowsPerPage={pageSize}
                                rowsPerPageOptions={[10, 25, 50, 100]}
                                onPageChange={(_, next) => setPage(next)}
                                onRowsPerPageChange={(event) => {
                                    setPageSize(Number(event.target.value))
                                    setPage(0)
                                }}
                            />
                        </>
                    )}
                </Stack>
            </CardContent>
        </Card>
    )
}