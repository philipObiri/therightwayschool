import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { AppLoader } from '../components/AppLoader';
import { FileText, Download } from 'lucide-react';
import { Button } from '../components/ui/button';

const BACKEND_URL = import.meta.env.VITE_API_URL || '';

export default function FileViewerModal({ url, open, onClose, title = 'Document Viewer' }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !url) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
      setFileType(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Convert full URL to api path (strip backend URL and /api prefix)
    let apiPath = url;
    if (apiPath.startsWith(BACKEND_URL)) {
      apiPath = apiPath.replace(BACKEND_URL, '');
    }
    if (apiPath.startsWith('/api')) {
      apiPath = apiPath.substring(4);
    }

    api.get(apiPath, { responseType: 'blob' })
      .then(res => {
        const ct = res.headers['content-type'] || '';
        setFileType(ct);
        setBlobUrl(URL.createObjectURL(res.data));
      })
      .catch(err => {
        setError(err.response?.status ? `HTTP ${err.response.status}` : err.message || 'Failed to load');
      })
      .finally(() => setLoading(false));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, url]);

  const handleDownload = () => {
    if (blobUrl) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'document';
      a.click();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
          <h3 className="text-sm font-semibold text-[#1B2A4A] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#2E6CC4]" /> {title}
          </h3>
          <div className="flex items-center gap-2">
            {blobUrl && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleDownload}>
                <Download className="w-3 h-3 mr-1" /> Download
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto" style={{ height: '80vh' }}>
          {loading && (
            <div className="flex items-center justify-center h-full">
              <AppLoader />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-500 text-sm">Failed to load: {error}</p>
            </div>
          )}
          {blobUrl && !loading && !error && (
            <>
              {fileType?.startsWith('image/') ? (
                <div className="flex items-center justify-center p-4 bg-slate-100 h-full">
                  <img src={blobUrl} alt="Document" className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
                </div>
              ) : (
                <div className="h-full">
                  <object data={blobUrl} type={fileType || 'application/pdf'} className="w-full h-full" style={{ minHeight: '80vh' }}>
                    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
                      <FileText className="w-16 h-16 text-slate-300" />
                      <p className="text-sm text-slate-500">Your browser cannot display this file inline.</p>
                      <Button onClick={handleDownload} className="bg-[#2E6CC4]">
                        <Download className="w-4 h-4 mr-2" /> Download to View
                      </Button>
                    </div>
                  </object>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
