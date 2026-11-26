import { Autocomplete, Box, Button, Divider, TextField, Typography } from '@mui/material';
import { ModalWrapper } from '../common/ModalWrapper.tsx';
import { useGetUsers } from '../../utils/queries.tsx';
import { useState } from 'react';
import { getUserLabel, User } from '../../utils/users.ts';
import useDebounce from '../../hooks/useDebounce.ts';

type ShareSnippetModalProps = {
  open: boolean;
  onClose: () => void;
  onShare: (userId: string) => void;
  loading: boolean;
};
export const ShareSnippetModal = (props: ShareSnippetModalProps) => {
  const { open, onClose, onShare, loading } = props;
  const [name, setName] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const { data, isLoading } = useGetUsers(debouncedName, 1, 5);
  const [selectedUser, setSelectedUser] = useState<User | undefined>();

  useDebounce(() => setDebouncedName(name), [name], 300);

  function handleSelectUser(newValue: User | null) {
    newValue && setSelectedUser(newValue);
  }

  return (
    <ModalWrapper open={open} onClose={onClose}>
      <Typography variant={'h5'}>Share your snippet</Typography>
      <Divider />
      <Box mt={2}>
        <Autocomplete
          renderInput={(params) => <TextField {...params} label="Type the user's name" />}
          options={data?.users ?? []}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          getOptionLabel={getUserLabel}
          filterOptions={(options) => options}
          loading={isLoading}
          value={selectedUser}
          onInputChange={(_: unknown, newValue: string | null) => setName(newValue ?? '')}
          onChange={(_: unknown, newValue: User | null) => handleSelectUser(newValue)}
        />
        <Box mt={4} display={'flex'} width={'100%'} justifyContent={'flex-end'}>
          <Button onClick={onClose} variant={'outlined'}>
            Cancel
          </Button>
          <Button
            disabled={!selectedUser || loading}
            onClick={() => selectedUser && onShare(selectedUser?.id)}
            sx={{ marginLeft: 2 }}
            variant={'contained'}
          >
            Share
          </Button>
        </Box>
      </Box>
    </ModalWrapper>
  );
};
