'use client';

import { useId, useState } from 'react';
import ArrowIcon from '@/components/arrow-icon';

type ArticleActionsProps = {
  path: string;
};

export default function ArticleActions({ path }: ArticleActionsProps) {
  const statusId = useId();
  const [message, setMessage] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [copying, setCopying] = useState(false);

  async function copyLink() {
    if (copying) return;
    setCopying(true);
    setMessage('');
    setFallbackUrl('');
    const url = new URL(path, window.location.origin).href;

    try {
      await navigator.clipboard.writeText(url);
      setMessage('Yazının bağlantısı kopyalandı');
    } catch {
      setMessage('Bağlantıyı aşağıdaki alandan kopyalayabilirsin');
      setFallbackUrl(url);
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="article-share">
      <button
        type="button"
        className="understated-link"
        onClick={copyLink}
        disabled={copying}
        aria-describedby={statusId}
      >
        {copying ? 'Kopyalanıyor' : 'Bağlantıyı kopyala'}
        <ArrowIcon direction="diagonal" />
      </button>
      <p className="share-status" id={statusId} role="status" aria-live="polite">
        {message}
      </p>
      {fallbackUrl ? (
        <input
          className="share-url"
          type="url"
          value={fallbackUrl}
          readOnly
          aria-label="Yazının bağlantısı"
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </div>
  );
}
