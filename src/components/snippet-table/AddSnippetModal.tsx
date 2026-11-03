import {
  Alert,
  Box,
  Button,
  capitalize,
  CircularProgress,
  Input,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from '@mui/material';
import { highlight, languages } from 'prismjs';
import { useEffect, useState } from 'react';
import Editor from 'react-simple-code-editor';

import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/themes/prism-okaidia.css';
import { Save } from '@mui/icons-material';
import { CreateSnippet, CreateSnippetWithLang } from '../../utils/snippet.ts';
import { ModalWrapper } from '../common/ModalWrapper.tsx';
import { useCreateSnippet, useGetFileTypes } from '../../utils/queries.tsx';
import { queryClient } from '../../App.tsx';
import { ErrorDetail, HttpError } from '../../utils/httpSnippetOperations.ts';

export const AddSnippetModal = ({
  open,
  onClose,
  defaultSnippet,
}: {
  open: boolean;
  onClose: () => void;
  defaultSnippet?: CreateSnippetWithLang;
}) => {
  const [language, setLanguage] = useState(defaultSnippet?.language ?? 'printscript');
  const [code, setCode] = useState(defaultSnippet?.content ?? '');
  const [snippetName, setSnippetName] = useState(defaultSnippet?.name ?? '');
  const [description, setDescription] = useState(defaultSnippet?.description ?? '');
  const [version, setVersion] = useState(defaultSnippet?.version ?? '1.1');
  const [syntaxErrors, setSyntaxErrors] = useState<ErrorDetail[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { mutateAsync: createSnippet, isLoading: loadingSnippet } = useCreateSnippet({
    onSuccess: () => queryClient.invalidateQueries('listSnippets'),
  });
  const { data: fileTypes } = useGetFileTypes();

  const selectedFileType = fileTypes?.find((f) => f.language === language);
  const availableVersions =
    selectedFileType?.versions && selectedFileType.versions.length > 0
      ? selectedFileType.versions
      : ['1.1', '1.0'];

  const handleCreateSnippet = async () => {
    setSyntaxErrors([]);
    setErrorMessage(null);
    const newSnippet: CreateSnippet = {
      name: snippetName,
      description: description || undefined,
      version: version || '1.1',
      content: code,
      language: language,
      extension: selectedFileType?.extension ?? 'prs',
    };
    try {
      await createSnippet(newSnippet);
      onClose();
    } catch (err: unknown) {
      if (err instanceof HttpError) {
        setErrorMessage(err.message);
        if (err.details && err.details.length > 0) {
          setSyntaxErrors(err.details);
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to save snippet');
      }
    }
  };

  useEffect(() => {
    if (defaultSnippet) {
      setCode(defaultSnippet?.content);
      setLanguage(defaultSnippet?.language);
      setSnippetName(defaultSnippet?.name);
      setDescription(defaultSnippet?.description ?? '');
      setVersion(defaultSnippet?.version ?? '1.1');
    }
    setSyntaxErrors([]);
    setErrorMessage(null);
  }, [defaultSnippet, open]);

  return (
    <ModalWrapper open={open} onClose={onClose}>
      {
        <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
          <Typography
            id="modal-modal-title"
            variant="h5"
            component="h2"
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            Add Snippet
          </Typography>
          <Button
            disabled={!snippetName || !code || !language || loadingSnippet}
            variant="contained"
            disableRipple
            sx={{ boxShadow: 0 }}
            onClick={handleCreateSnippet}
          >
            <Box pr={1} display={'flex'} alignItems={'center'} justifyContent={'center'}>
              {loadingSnippet ? <CircularProgress size={24} /> : <Save />}
            </Box>
            Save Snippet
          </Button>
        </Box>
      }
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <InputLabel htmlFor="name">Name</InputLabel>
        <Input
          onChange={(e) => setSnippetName(e.target.value)}
          value={snippetName}
          id="name"
          sx={{ width: '50%' }}
        />
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <InputLabel htmlFor="description">Description</InputLabel>
        <Input
          onChange={(e) => setDescription(e.target.value)}
          value={description}
          id="description"
          placeholder="Brief snippet description (optional)"
          sx={{ width: '70%' }}
        />
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          gap: '16px',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <InputLabel htmlFor="language-select">Language</InputLabel>
          <Select
            labelId="language-select-label"
            id="language-select"
            value={language}
            onChange={(e: SelectChangeEvent<string>) => setLanguage(e.target.value)}
          >
            {fileTypes?.map((x) => (
              <MenuItem
                data-testid={`menu-option-${x.language}`}
                key={x.language}
                value={x.language}
              >
                {capitalize(x.language)}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <InputLabel htmlFor="version-select">Version</InputLabel>
          <Select
            id="version-select"
            value={version}
            onChange={(e: SelectChangeEvent<string>) => setVersion(e.target.value)}
          >
            {availableVersions.map((v) => (
              <MenuItem key={v} value={v}>
                {v}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>
      {errorMessage && (
        <Alert severity="error" sx={{ mt: 1, mb: 1 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            {errorMessage}
          </Typography>
          {syntaxErrors.length > 0 && (
            <Box component="ul" sx={{ pl: 2, m: 0, mt: 0.5 }}>
              {syntaxErrors.map((err, idx) => (
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
      <InputLabel>Code Snippet</InputLabel>
      <Box
        width={'100%'}
        sx={{
          backgroundColor: 'black',
          color: 'white',
          borderRadius: '8px',
        }}
      >
        <Editor
          value={code}
          padding={10}
          data-testid={'add-snippet-code-editor'}
          onValueChange={(code) => setCode(code)}
          highlight={(code) => highlight(code, languages.js, 'javascript')}
          style={{
            borderRadius: '8px',
            overflow: 'auto',
            minHeight: '300px',
            maxHeight: '600px',
            width: '100%',
            fontFamily: 'monospace',
            fontSize: 17,
          }}
        />
      </Box>
    </ModalWrapper>
  );
};
