import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputBase,
  InputLabel,
  Menu,
  MenuItem,
  Select,
  styled,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
} from '@mui/material';
import { AddSnippetModal } from './AddSnippetModal.tsx';
import { useRef, useState } from 'react';
import { Add, Search } from '@mui/icons-material';
import { LoadingSnippetRow, SnippetRow } from './SnippetRow.tsx';
import { CreateSnippetWithLang, getFileLanguage, Snippet } from '../../utils/snippet.ts';
import { usePaginationContext } from '../../contexts/paginationContext.tsx';
import { useSnackbarContext } from '../../contexts/snackbarContext.tsx';
import { useGetFileTypes } from '../../utils/queries.tsx';

type SnippetTableProps = {
  handleClickSnippet: (id: string) => void;
  snippets?: Snippet[];
  loading: boolean;
  handleSearchSnippet: (snippetName: string) => void;
  relation?: 'ALL' | 'OWNED' | 'SHARED';
  handleRelationChange?: (relation: 'ALL' | 'OWNED' | 'SHARED') => void;
  lintStatus?: string;
  handleLintStatusChange?: (status: string) => void;
  language?: string;
  handleLanguageChange?: (language: string) => void;
  sort?: 'updatedAt' | 'name' | 'language' | 'lintStatus';
  order?: 'asc' | 'desc';
  handleSortChange?: (sort: 'updatedAt' | 'name' | 'language' | 'lintStatus') => void;
};

export const SnippetTable = (props: SnippetTableProps) => {
  const {
    snippets,
    handleClickSnippet,
    loading,
    handleSearchSnippet,
    relation = 'ALL',
    handleRelationChange,
    lintStatus = 'ALL',
    handleLintStatusChange,
    language = 'ALL',
    handleLanguageChange,
    sort = 'updatedAt',
    order = 'desc',
    handleSortChange,
  } = props;

  const [addModalOpened, setAddModalOpened] = useState(false);
  const [popoverMenuOpened, setPopoverMenuOpened] = useState(false);
  const [snippet, setSnippet] = useState<CreateSnippetWithLang | undefined>();

  const popoverRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    page,
    page_size: pageSize,
    count,
    handleChangePageSize,
    handleGoToPage,
  } = usePaginationContext();
  const { createSnackbar } = useSnackbarContext();
  const { data: fileTypes } = useGetFileTypes();

  const handleLoadSnippet = async (target: EventTarget & HTMLInputElement) => {
    const files = target.files;
    if (!files || !files.length) {
      createSnackbar('error', 'Please select at least one file');
      return;
    }
    const file = files[0];
    const splitName = file.name.split('.');
    const fileType = getFileLanguage(fileTypes ?? [], splitName.at(-1));
    if (!fileType) {
      createSnackbar('error', `File type ${splitName.at(-1)} not supported`);
      return;
    }
    file
      .text()
      .then((text) => {
        setSnippet({
          name: splitName[0],
          content: text,
          language: fileType.language,
          extension: fileType.extension,
        });
      })
      .catch((e) => {
        console.error(e);
      })
      .finally(() => {
        setAddModalOpened(true);
        target.value = '';
      });
  };

  function handleClickMenu() {
    setPopoverMenuOpened(false);
  }

  return (
    <>
      <Box display="flex" flexDirection="column" gap={2}>
        <Box display="flex" flexDirection="row" justifyContent="space-between" alignItems="center">
          <Box sx={{ background: 'white', width: '35%', display: 'flex', borderRadius: 1 }}>
            <InputBase
              sx={{ ml: 1, flex: 1 }}
              placeholder="Search snippet by name"
              inputProps={{ 'aria-label': 'search' }}
              onChange={(e) => handleSearchSnippet(e.target.value)}
            />
            <IconButton type="button" sx={{ p: '10px' }} aria-label="search">
              <Search />
            </IconButton>
          </Box>
          <Button
            ref={popoverRef}
            variant="contained"
            disableRipple
            sx={{ boxShadow: 0 }}
            onClick={() => setPopoverMenuOpened(true)}
          >
            <Add />
            Add Snippet
          </Button>
        </Box>

        <Box display="flex" flexDirection="row" gap={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160, background: 'white', borderRadius: 1 }}>
            <InputLabel id="relation-select-label">Scope</InputLabel>
            <Select
              labelId="relation-select-label"
              value={relation}
              label="Scope"
              onChange={(e) => handleRelationChange?.(e.target.value as 'ALL' | 'OWNED' | 'SHARED')}
            >
              <MenuItem value="ALL">All Snippets</MenuItem>
              <MenuItem value="OWNED">My Snippets (Owner)</MenuItem>
              <MenuItem value="SHARED">Shared with me</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160, background: 'white', borderRadius: 1 }}>
            <InputLabel id="lint-status-select-label">Compliance</InputLabel>
            <Select
              labelId="lint-status-select-label"
              value={lintStatus}
              label="Compliance"
              onChange={(e) => handleLintStatusChange?.(e.target.value)}
            >
              <MenuItem value="ALL">All Statuses</MenuItem>
              <MenuItem value="COMPLIANT">Compliant</MenuItem>
              <MenuItem value="NON_COMPLIANT">Non-Compliant</MenuItem>
              <MenuItem value="PENDING">Pending</MenuItem>
              <MenuItem value="FAILED">Failed</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160, background: 'white', borderRadius: 1 }}>
            <InputLabel id="language-select-label">Language</InputLabel>
            <Select
              labelId="language-select-label"
              value={language}
              label="Language"
              onChange={(e) => handleLanguageChange?.(e.target.value)}
            >
              <MenuItem value="ALL">All Languages</MenuItem>
              {(fileTypes ?? []).map((ft) => (
                <MenuItem key={ft.language} value={ft.language}>
                  {ft.language.charAt(0).toUpperCase() + ft.language.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      <Table size="medium" sx={{ borderSpacing: '0 10px', borderCollapse: 'separate', mt: 2 }}>
        <TableHead>
          <TableRow sx={{ fontWeight: 'bold' }}>
            <StyledTableCell sx={{ fontWeight: 'bold' }}>
              <TableSortLabel
                active={sort === 'name'}
                direction={sort === 'name' ? order : 'asc'}
                onClick={() => handleSortChange?.('name')}
              >
                Name
              </TableSortLabel>
            </StyledTableCell>
            <StyledTableCell sx={{ fontWeight: 'bold' }}>
              <TableSortLabel
                active={sort === 'language'}
                direction={sort === 'language' ? order : 'asc'}
                onClick={() => handleSortChange?.('language')}
              >
                Language
              </TableSortLabel>
            </StyledTableCell>
            <StyledTableCell sx={{ fontWeight: 'bold' }}>Author</StyledTableCell>
            <StyledTableCell sx={{ fontWeight: 'bold' }}>
              <TableSortLabel
                active={sort === 'lintStatus'}
                direction={sort === 'lintStatus' ? order : 'asc'}
                onClick={() => handleSortChange?.('lintStatus')}
              >
                Conformance
              </TableSortLabel>
            </StyledTableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <>
              {Array.from({ length: 10 }).map((_, index) => (
                <LoadingSnippetRow key={index} />
              ))}
            </>
          ) : (
            <>
              {snippets &&
                snippets.map((snippet) => (
                  <SnippetRow
                    data-testid={'snippet-row'}
                    onClick={() => handleClickSnippet(snippet.id)}
                    key={snippet.id}
                    snippet={snippet}
                  />
                ))}
            </>
          )}
        </TableBody>
        <TablePagination
          count={count}
          page={page}
          rowsPerPage={pageSize}
          onPageChange={(_, page) => handleGoToPage(page)}
          onRowsPerPageChange={(e) => handleChangePageSize(Number(e.target.value))}
        />
      </Table>
      <AddSnippetModal
        defaultSnippet={snippet}
        open={addModalOpened}
        onClose={() => setAddModalOpened(false)}
      />
      <Menu anchorEl={popoverRef.current} open={popoverMenuOpened} onClick={handleClickMenu}>
        <MenuItem onClick={() => setAddModalOpened(true)}>Create snippet</MenuItem>
        <MenuItem onClick={() => inputRef?.current?.click()}>Load snippet from file</MenuItem>
      </Menu>
      <input
        hidden
        type={'file'}
        ref={inputRef}
        multiple={false}
        data-testid={'upload-file-input'}
        onChange={(e) => handleLoadSnippet(e?.target)}
      />
    </>
  );
};

export const StyledTableCell = styled(TableCell)`
  border: 0;
  align-items: center;
`;
