import { withNavbar } from '../components/navbar/withNavbar.tsx';
import { SnippetTable } from '../components/snippet-table/SnippetTable.tsx';
import { useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { SnippetDetail } from './SnippetDetail.tsx';
import { Drawer } from '@mui/material';
import { useGetSnippets } from '../utils/queries.tsx';
import { usePaginationContext } from '../contexts/paginationContext.tsx';
import useDebounce from '../hooks/useDebounce.ts';
import { SnippetFilterOptions } from '../utils/snippetOperations.ts';

const HomeScreen = () => {
  const { id: paramsId } = useParams<{ id: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [snippetName, setSnippetName] = useState('');
  const [snippetId, setSnippetId] = useState<string | null>(null);

  const [relation, setRelation] = useState<'ALL' | 'OWNED' | 'SHARED'>('ALL');
  const [lintStatus, setLintStatus] = useState<string>('ALL');
  const [language, setLanguage] = useState<string>('ALL');
  const [sort, setSort] = useState<'updatedAt' | 'name' | 'language' | 'lintStatus'>('updatedAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const { page, page_size, count, handleChangeCount, handleGoToPage } = usePaginationContext();

  // DeBounce Function
  useDebounce(
    () => {
      setSnippetName(searchTerm);
    },
    [searchTerm],
    800,
  );

  const filterOptions: SnippetFilterOptions = useMemo(
    () => ({
      name: snippetName || undefined,
      relation: relation !== 'ALL' ? relation : undefined,
      language: language !== 'ALL' ? language : undefined,
      lintStatus:
        lintStatus !== 'ALL'
          ? (lintStatus as 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING' | 'FAILED')
          : undefined,
      sort,
      order,
    }),
    [snippetName, relation, language, lintStatus, sort, order],
  );

  const { data, isLoading } = useGetSnippets(page, page_size, filterOptions);

  useEffect(() => {
    if (data?.count && data.count != count) {
      handleChangeCount(data.count);
    }
  }, [count, data?.count, handleChangeCount]);

  useEffect(() => {
    if (paramsId) {
      setSnippetId(paramsId);
    }
  }, [paramsId]);

  const handleCloseModal = () => setSnippetId(null);

  const handleSearchSnippet = (name: string) => {
    setSearchTerm(name);
    handleGoToPage(0);
  };

  const handleRelationChange = (newRelation: 'ALL' | 'OWNED' | 'SHARED') => {
    setRelation(newRelation);
    handleGoToPage(0);
  };

  const handleLintStatusChange = (newStatus: string) => {
    setLintStatus(newStatus);
    handleGoToPage(0);
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    handleGoToPage(0);
  };

  const handleSortChange = (newSort: 'updatedAt' | 'name' | 'language' | 'lintStatus') => {
    if (sort === newSort) {
      setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(newSort);
      setOrder('asc');
    }
    handleGoToPage(0);
  };

  return (
    <>
      <SnippetTable
        loading={isLoading}
        handleClickSnippet={setSnippetId}
        snippets={data?.snippets}
        handleSearchSnippet={handleSearchSnippet}
        relation={relation}
        handleRelationChange={handleRelationChange}
        lintStatus={lintStatus}
        handleLintStatusChange={handleLintStatusChange}
        language={language}
        handleLanguageChange={handleLanguageChange}
        sort={sort}
        order={order}
        handleSortChange={handleSortChange}
      />
      <Drawer open={!!snippetId} anchor={'right'} onClose={handleCloseModal}>
        {snippetId && <SnippetDetail handleCloseModal={handleCloseModal} id={snippetId} />}
      </Drawer>
    </>
  );
};

export default withNavbar(HomeScreen);
