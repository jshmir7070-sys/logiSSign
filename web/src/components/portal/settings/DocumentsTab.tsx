'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  type DocumentFile,
  getDocumentFiles,
  uploadDocumentFile,
  saveDocumentFile,
} from '@/services/seal.service';
import {
  sendDocuments,
  getDocumentDeliveries,
  type SendMethod,
  type DocumentDelivery,
  SEND_METHOD_LABELS,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_COLORS,
} from '@/services/document-send.service';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function DocumentsTab({ agencyId }: { agencyId: string }) {
  const [docs, setDocs] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [sendingDoc, setSendingDoc] = useState<DocumentFile | null>(null);
  const [drivers, setDrivers] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set());
  const [sendMethod, setSendMethod] = useState<SendMethod>('both');
  const [sendMessage, setSendMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const [viewDeliveriesDocId, setViewDeliveriesDocId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DocumentDelivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const loadDocs = async () => {
    setLoading(true);
    const data = await getDocumentFiles(agencyId);
    setDocs(data);
    setLoading(false);
  };

  const loadDrivers = async () => {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.from('drivers').select('id, name, phone').eq('agency_id', agencyId).eq('status', 'active').order('name');
    setDrivers((data ?? []) as { id: string; name: string; phone: string }[]);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadDocs(); loadDrivers(); }, [agencyId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { path, error } = await uploadDocumentFile(agencyId, file);
    if (!error && path) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const fileType = ext === 'pdf' ? 'pdf' : ext === 'docx' || ext === 'doc' ? 'docx' : 'image';
      await saveDocumentFile({
        agency_id: agencyId,
        title: file.name,
        file_url: path,
        file_type: fileType,
        file_size: file.size,
        status: 'uploaded',
      });
      loadDocs();
    }
    setUploading(false);
    e.target.value = '';
  };

  const openSendModal = (doc: DocumentFile) => {
    setSendingDoc(doc);
    setSelectedDriverIds(new Set());
    setSendMethod('both');
    setSendMessage('');
    setSendResult(null);
  };

  const handleSend = async () => {
    if (!sendingDoc || selectedDriverIds.size === 0) return;
    setSending(true);
    setSendResult(null);

    const result = await sendDocuments({
      agencyId,
      driverIds: Array.from(selectedDriverIds),
      sendType: 'general',
      sendMethod,
      title: sendingDoc.title,
      message: sendMessage || undefined,
      documentFileId: sendingDoc.id,
    });

    if (result.error) {
      setSendResult(`전송 실패: ${result.error}`);
    } else {
      setSendResult(`${result.total}명에게 전송 완료 (푸시 ${result.pushSent}건, SMS ${result.smsSent}건)`);
      loadDocs();
    }
    setSending(false);
  };

  const viewDeliveries = async (docId: string) => {
    setViewDeliveriesDocId(docId);
    setLoadingDeliveries(true);
    const res = await getDocumentDeliveries(agencyId, { documentFileId: docId });
    setDeliveries(res.data ?? []);
    setLoadingDeliveries(false);
  };

  const toggleAllDrivers = () => {
    if (selectedDriverIds.size === drivers.length) {
      setSelectedDriverIds(new Set());
    } else {
      setSelectedDriverIds(new Set(drivers.map((d) => d.id)));
    }
  };

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    uploaded: { label: '업로드됨', color: 'bg-surface-container-high text-on-surface-variant' },
    sealed: { label: '도장완료', color: 'bg-tertiary/10 text-tertiary' },
    signed: { label: '서명완료', color: 'bg-primary/10 text-primary' },
    sent: { label: '전송완료', color: 'bg-secondary/10 text-secondary' },
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-headline font-bold text-on-surface font-korean">문서 관리</h2>
            <p className="text-sm text-on-surface-variant font-korean mt-1">내 컴퓨터에서 문서를 업로드하고 기사에게 전송할 수 있습니다</p>
          </div>
          <label className={`h-10 px-5 rounded-xl bg-primary text-white text-sm font-semibold font-korean hover:bg-primary/90 transition-colors flex items-center gap-2 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {uploading ? '업로드 중...' : '문서 업로드'}
            <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={handleUpload} className="hidden" />
          </label>
        </div>

        <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/10">
          <p className="text-xs font-semibold text-primary font-korean mb-2">문서 전송 안내</p>
          <div className="space-y-1 text-xs text-on-surface-variant font-korean">
            <p><span className="font-semibold">기사 등록시</span> — 카테고리 계약서 템플릿이 자동 전송됩니다</p>
            <p><span className="font-semibold">재계약시</span> — 계약 변경 메뉴에서 재계약 유형 선택 후 서류를 전송합니다</p>
            <p><span className="font-semibold">상시 전송</span> — 아래 문서를 업로드 후 [전송] 버튼으로 선택한 기사에게 전송합니다</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm text-on-surface-variant font-korean">불러오는 중...</div>
        ) : docs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <p className="text-sm text-on-surface-variant font-korean">업로드된 문서가 없습니다</p>
            <p className="text-xs text-on-surface-variant/50 font-korean mt-1">PDF, Word, 이미지 파일을 업로드하세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => {
              const st = STATUS_LABELS[doc.status] ?? STATUS_LABELS.uploaded;
              return (
                <div key={doc.id} className="flex items-center gap-4 p-4 rounded-xl border border-outline-variant/15 hover:bg-surface-container-low/50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {doc.file_type === 'pdf' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface font-korean truncate">{doc.title}</p>
                    <p className="text-[11px] text-on-surface-variant/60 font-data mt-0.5">
                      {formatFileSize(doc.file_size ?? 0)} · {new Date(doc.created_at ?? '').toLocaleDateString('ko-KR')}
                      {doc.recipients && doc.recipients.length > 0 && ` · ${doc.recipients.length}명 전송`}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold font-korean ${st.color}`}>
                    {st.label}
                  </span>
                  <div className="flex gap-2">
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="h-8 px-3 rounded-lg bg-surface-container-low text-[11px] text-on-surface-variant font-korean hover:bg-surface-container-high transition-colors flex items-center">보기</a>
                    <button onClick={() => openSendModal(doc)} className="h-8 px-3 rounded-lg bg-primary/10 text-[11px] text-primary font-semibold font-korean hover:bg-primary/20 transition-colors flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      전송
                    </button>
                    {doc.status === 'sent' && (
                      <button onClick={() => viewDeliveries(doc.id)} className="h-8 px-3 rounded-lg bg-surface-container-low text-[11px] text-on-surface-variant font-korean hover:bg-surface-container-high transition-colors flex items-center">내역</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {sendingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !sending && setSendingDoc(null)}>
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-outline-variant/15">
              <h3 className="text-lg font-headline font-bold text-on-surface font-korean">문서 전송</h3>
              <p className="text-sm text-on-surface-variant font-korean mt-1 truncate">{sendingDoc.title}</p>
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-5">
              <div>
                <label className="block text-xs font-label font-medium text-on-surface-variant mb-2 font-korean">전송 방법</label>
                <div className="flex gap-2">
                  {(['push', 'sms', 'both'] as SendMethod[]).map((m) => (
                    <button key={m} onClick={() => setSendMethod(m)}
                      className={`h-9 px-4 rounded-lg text-xs font-semibold font-korean transition-colors ${sendMethod === m ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'}`}
                    >{SEND_METHOD_LABELS[m]}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-label font-medium text-on-surface-variant mb-2 font-korean">전송 메시지 (선택)</label>
                <textarea value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} placeholder="기사에게 함께 전달할 메시지를 입력하세요" rows={2}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/40 resize-none font-korean" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-label font-medium text-on-surface-variant font-korean">수신 기사 선택</label>
                  <button onClick={toggleAllDrivers} className="text-[11px] text-primary font-korean hover:underline">
                    {selectedDriverIds.size === drivers.length ? '전체 해제' : '전체 선택'}
                  </button>
                </div>
                {drivers.length === 0 ? (
                  <p className="text-xs text-on-surface-variant/60 font-korean py-4 text-center">등록된 기사가 없습니다</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-outline-variant/15">
                    {drivers.map((d) => {
                      const checked = selectedDriverIds.has(d.id);
                      return (
                        <label key={d.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-low/50 cursor-pointer border-b border-outline-variant/5 last:border-b-0">
                          <input type="checkbox" checked={checked} onChange={() => {
                            const next = new Set(selectedDriverIds);
                            if (checked) next.delete(d.id); else next.add(d.id);
                            setSelectedDriverIds(next);
                          }} className="w-4 h-4 rounded accent-primary" />
                          <span className="text-sm text-on-surface font-korean">{d.name}</span>
                          <span className="text-[11px] text-on-surface-variant/60 font-data ml-auto">{d.phone}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-on-surface-variant/60 font-korean mt-1">{selectedDriverIds.size}명 선택됨</p>
              </div>
              {sendResult && (
                <div className={`p-3 rounded-xl text-sm font-korean ${sendResult.startsWith('전송 실패') ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
                  {sendResult}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-outline-variant/15 flex justify-end gap-3">
              <button onClick={() => setSendingDoc(null)} disabled={sending} className="h-10 px-5 rounded-xl bg-surface-container-low text-on-surface-variant text-sm font-korean hover:bg-surface-container-high transition-colors">취소</button>
              <button onClick={handleSend} disabled={sending || selectedDriverIds.size === 0}
                className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-semibold font-korean hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
                {sending ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg> 전송 중...</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> {selectedDriverIds.size}명에게 전송</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewDeliveriesDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setViewDeliveriesDocId(null)}>
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-outline-variant/15 flex items-center justify-between">
              <h3 className="text-lg font-headline font-bold text-on-surface font-korean">전송 내역</h3>
              <button onClick={() => setViewDeliveriesDocId(null)} className="text-on-surface-variant hover:text-on-surface">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              {loadingDeliveries ? (
                <p className="text-sm text-on-surface-variant font-korean text-center py-8">불러오는 중...</p>
              ) : deliveries.length === 0 ? (
                <p className="text-sm text-on-surface-variant font-korean text-center py-8">전송 내역이 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {deliveries.map((del) => {
                    const statusLabel = DELIVERY_STATUS_LABELS[del.status] ?? del.status;
                    const statusColor = DELIVERY_STATUS_COLORS[del.status] ?? 'gray';
                    const colorMap: Record<string, string> = {
                      blue: 'bg-blue-100 text-blue-700',
                      cyan: 'bg-cyan-100 text-cyan-700',
                      orange: 'bg-orange-100 text-orange-700',
                      green: 'bg-green-100 text-green-700',
                      red: 'bg-red-100 text-red-700',
                      gray: 'bg-gray-100 text-gray-600',
                    };
                    const driverInfo = (del as unknown as { drivers?: { name: string; phone: string } }).drivers;
                    return (
                      <div key={del.id} className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant/10">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-on-surface font-korean">{driverInfo?.name ?? '기사'}</p>
                          <p className="text-[11px] text-on-surface-variant/60 font-data">{driverInfo?.phone ?? ''} · {new Date(del.sent_at).toLocaleDateString('ko-KR')}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold font-korean ${colorMap[statusColor] ?? colorMap.gray}`}>
                          {statusLabel}
                        </span>
                        {del.viewed_at && <span className="text-[10px] text-on-surface-variant/50 font-data">열람 {new Date(del.viewed_at).toLocaleDateString('ko-KR')}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
