import React, { useEffect, useState } from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/themes/prism-okaidia.css';
import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {
  useDownloadSnippet,
  useFormatSnippet,
  useGetSnippetById,
  useShareSnippet,
  useUpdateSnippetById,
} from '../utils/queries.tsx';
import { Bòx } from '../components/snippet-table/SnippetBox.tsx';
import { BugReport, Delete, Download, Save, Share } from '@mui/icons-material';
import { ShareSnippetModal } from '../components/snippet-detail/ShareSnippetModal.tsx';
import { TestSnippetModal } from '../components/snippet-test/TestSnippetModal.tsx';
import { Snippet } from '../utils/snippet.ts';
import { SnippetExecution } from './SnippetExecution.tsx';
import ReadMoreIcon from '@mui/icons-material/ReadMore';
import { queryClient } from '../App.tsx';
import { DeleteConfirmationModal } from '../components/snippet-detail/DeleteConfirmationModal.tsx';
import { ErrorDetail, HttpError, triggerBlobDownload } from '../utils/httpSnippetOperations.ts';

type SnippetDetailProps = {
  id: string;
  handleCloseModal: () => void;
};

const DownloadMenuButton = ({ snippet }: { snippet?: Snippet }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { mutateAsync: download, isLoading } = useDownloadSnippet();

  if (!snippet) return null;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleDownload = async (formatted: boolean) => {
    handleClose();
    try {
      const { blob, filename } = await download({ id: snippet.id, formatted });
      triggerBlobDownload(blob, filename || `${snippet.name}.${snippet.extension}`);
    } catch {
      // Fallback: descarga local si el backend no está disponible
      const file = new Blob([snippet.content], { type: 'text/plain' });
      triggerBlobDownload(file, `${snippet.name}.${snippet.extension}`);
    }
  };

  return (
    <>
      <Tooltip title={'Download'}>
        <IconButton onClick={handleClick} disabled={isLoading}>
          {isLoading ? <CircularProgress size={20} /> : <Download />}
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        <MenuItem onClick={() => handleDownload(false)}>Download original snippet</MenuItem>
        <MenuItem onClick={() => handleDownload(true)}>Download formatted snippet</MenuItem>
      </Menu>
    </>
  );
};

export const SnippetDetail = (props: SnippetDetailProps) => {
  const { id, handleCloseModal } = props;
  const [code, setCode] = useState('');
  const [shareModalOppened, setShareModalOppened] = useState(false);
  const [deleteConfirmationModalOpen, setDeleteConfirmationModalOpen] = useState(false);
  const [testModalOpened, setTestModalOpened] = useState(false);

  const [updateErrors, setUpdateErrors] = useState<ErrorDetail[]>([]);
  const [updateErrorMessage, setUpdateErrorMessage] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const { data: snippet, isLoading } = useGetSnippetById(id);
  const { mutate: shareSnippet, isLoading: loadingShare } = useShareSnippet();
  const {
    mutate: formatSnippet,
    isLoading: isFormatLoading,
    data: formatSnippetData,
  } = useFormatSnippet();
  const { mutateAsync: updateSnippet, isLoading: isUpdateSnippetLoading } = useUpdateSnippetById({
    onSuccess: () => {
      setUpdateErrors([]);
      setUpdateErrorMessage(null);
      setUpdateSuccess(true);
      queryClient.invalidateQueries(['snippet', id]);
      queryClient.invalidateQueries('listSnippets');
    },
  });

  const handleSave = async () => {
    setUpdateErrors([]);
    setUpdateErrorMessage(null);
    setUpdateSuccess(false);
    try {
      await updateSnippet({ id, updateSnippet: { content: code } });
    } catch (err: unknown) {
      if (err instanceof HttpError) {
        setUpdateErrorMessage(err.message);
        if (err.details && err.details.length > 0) {
          setUpdateErrors(err.details);
        }
      } else if (err instanceof Error) {
        setUpdateErrorMessage(err.message);
      } else {
        setUpdateErrorMessage('Failed to save snippet changes');
      }
    }
  };

  useEffect(() => {
    if (snippet) {
      setCode(snippet.content);
    }
    setUpdateErrors([]);
    setUpdateErrorMessage(null);
    setUpdateSuccess(false);
  }, [snippet]);

  useEffect(() => {
    if (formatSnippetData) {
      setCode(formatSnippetData);
    }
  }, [formatSnippetData]);

  async function handleShareSnippet(userId: string) {
    shareSnippet({ snippetId: id, userId });
  }

  return (
    <Box p={4} minWidth={'60vw'}>
      <Box width={'100%'} p={2} display={'flex'} justifyContent={'flex-end'}>
        <CloseIcon style={{ cursor: 'pointer' }} onClick={handleCloseModal} />
      </Box>
      {isLoading ? (
        <>
          <Typography fontWeight={'bold'} mb={2} variant="h4">
            Loading...
          </Typography>
          <CircularProgress />
        </>
      ) : (
        <>
          <Typography variant="h4" fontWeight={'bold'}>
            {snippet?.name ?? 'Snippet'}
          </Typography>
          {snippet?.description && (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
              {snippet.description}
            </Typography>
          )}
          <Box display="flex" flexDirection="row" gap="8px" padding="8px">
            <Tooltip title={'Share'}>
              <IconButton onClick={() => setShareModalOppened(true)}>
                <Share />
              </IconButton>
            </Tooltip>
            <Tooltip title={'Test'}>
              <IconButton onClick={() => setTestModalOpened(true)}>
                <BugReport />
              </IconButton>
            </Tooltip>
            <DownloadMenuButton snippet={snippet} />
            {/*<Tooltip title={runSnippet ? "Stop run" : "Run"}>*/}
            {/*  <IconButton onClick={() => setRunSnippet(!runSnippet)}>*/}
            {/*    {runSnippet ? <StopRounded/> : <PlayArrow/>}*/}
            {/*  </IconButton>*/}
            {/*</Tooltip>*/}
            {/* TODO: we can implement a live mode*/}
            <Tooltip title={'Format'}>
              <IconButton onClick={() => formatSnippet(code)} disabled={isFormatLoading}>
                <ReadMoreIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={'Save changes'}>
              <IconButton
                color={'primary'}
                onClick={handleSave}
                disabled={isUpdateSnippetLoading || snippet?.content === code}
              >
                {isUpdateSnippetLoading ? <CircularProgress size={20} /> : <Save />}
              </IconButton>
            </Tooltip>
            <Tooltip title={'Delete'}>
              <IconButton onClick={() => setDeleteConfirmationModalOpen(true)}>
                <Delete color={'error'} />
              </IconButton>
            </Tooltip>
          </Box>
          {updateErrorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                {updateErrorMessage}
              </Typography>
              {updateErrors.length > 0 && (
                <Box component="ul" sx={{ pl: 2, m: 0, mt: 0.5 }}>
                  {updateErrors.map((err, idx) => (
                    <Typography component="li" variant="body2" key={idx}>
                      {err.line != null && err.column != null
                        ? `Line ${err.line}, Col ${err.column}: `
                        : ''}
                      {err.message || err.rule || 'Syntax error'}
                    </Typography>
                  ))}
                </Box>
              )}
            </Alert>
          )}
          {updateSuccess && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setUpdateSuccess(false)}>
              Snippet changes saved successfully.
            </Alert>
          )}
          {snippet?.lintViolations && snippet.lintViolations.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                Linting Violations ({snippet.lintViolations.length})
              </Typography>
              <Box component="ul" sx={{ pl: 2, m: 0, mt: 0.5 }}>
                {snippet.lintViolations.map((violation, idx) => (
                  <Typography component="li" variant="body2" key={idx}>
                    {violation.line != null && violation.column != null
                      ? `Line ${violation.line}, Col ${violation.column} [${violation.rule}]: `
                      : `[${violation.rule}]: `}
                    {violation.message}
                  </Typography>
                ))}
              </Box>
            </Alert>
          )}
          {snippet?.compliance === 'compliant' && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Snippet complies with all linting rules.
            </Alert>
          )}
          <Box display={'flex'} gap={2}>
            <Bòx
              flex={1}
              height={'fit-content'}
              overflow={'none'}
              minHeight={'500px'}
              bgcolor={'black'}
              color={'white'}
              code={code}
            >
              <Editor
                value={code}
                padding={10}
                onValueChange={(code) => setCode(code)}
                highlight={(code) => highlight(code, languages.js, 'javascript')}
                maxLength={1000}
                style={{
                  minHeight: '500px',
                  fontFamily: 'monospace',
                  fontSize: 17,
                }}
              />
            </Bòx>
          </Box>
          <Box pt={1} flex={1} marginTop={2}>
            <Alert severity="info">Output</Alert>
            <SnippetExecution />
          </Box>
        </>
      )}
      <ShareSnippetModal
        loading={loadingShare || isLoading}
        open={shareModalOppened}
        onClose={() => setShareModalOppened(false)}
        onShare={handleShareSnippet}
      />
      <TestSnippetModal
        open={testModalOpened}
        onClose={() => setTestModalOpened(false)}
        snippetId={snippet?.id}
      />
      <DeleteConfirmationModal
        open={deleteConfirmationModalOpen}
        onClose={() => setDeleteConfirmationModalOpen(false)}
        id={snippet?.id ?? ''}
        setCloseDetails={handleCloseModal}
      />
    </Box>
  );
};
