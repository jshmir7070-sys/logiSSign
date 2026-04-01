const services = [
  { name: '정산 엔진', icon: 'calculate', status: '정상', statusColor: '#16a34a', uptime: 99.98, lastCheck: '2분 전' },
  { name: 'PDF 생성', icon: 'picture_as_pdf', status: '정상', statusColor: '#16a34a', uptime: 99.95, lastCheck: '1분 전' },
  { name: 'SMS 발송', icon: 'sms', status: '지연', statusColor: '#ca8a04', uptime: 98.72, lastCheck: '3분 전' },
  { name: '스토리지', icon: 'cloud_upload', status: '정상', statusColor: '#16a34a', uptime: 99.99, lastCheck: '1분 전' },
];

const incidents = [
  { title: 'SMS 발송 지연 (평균 응답시간 3.2초)', severity: '주의', time: '2026-03-27 09:42', status: '조사중' },
  { title: 'PDF 생성 서버 메모리 경고 (85% 사용)', severity: '경고', time: '2026-03-26 22:15', status: '해결됨' },
  { title: '정산 엔진 배치 처리 지연 (5분 초과)', severity: '경고', time: '2026-03-25 03:10', status: '해결됨' },
];

const severityColor: Record<string, string> = {
  '주의': 'text-amber-600 bg-amber-50',
  '경고': 'text-error bg-error-container',
};

const incidentStatusColor: Record<string, string> = {
  '조사중': 'text-amber-600',
  '해결됨': 'text-tertiary',
};

export default function ServerPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-headline text-on-surface text-[26px] font-bold tracking-tight">
          서버 상태
        </h2>
        <p className="font-body text-on-surface-variant text-[14px] mt-1">
          핵심 서비스 가동 현황 및 장애 이력
        </p>
      </div>

      {/* Service Status Cards */}
      <div className="grid grid-cols-4 gap-5">
        {services.map((svc) => (
          <div
            key={svc.name}
            className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-primary/[0.08] flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[22px] text-primary"
                  style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
                >
                  {svc.icon}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: svc.statusColor }}
                />
                <span
                  className="font-label text-[12px] font-semibold"
                  style={{ color: svc.statusColor }}
                >
                  {svc.status}
                </span>
              </div>
            </div>
            <div>
              <p className="font-body text-on-surface text-[15px] font-semibold">
                {svc.name}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="font-label text-on-surface-variant text-[12px]">
                  Uptime
                </span>
                <span className="font-data text-on-surface text-[14px] font-bold">
                  {svc.uptime}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-surface-container-low mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${svc.uptime}%`,
                    backgroundColor: svc.statusColor,
                  }}
                />
              </div>
              <p className="font-label text-on-surface-variant/60 text-[11px] mt-2">
                마지막 확인: {svc.lastCheck}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* API Response Time Chart */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6 min-h-[320px]">
        <h3 className="font-headline text-on-surface text-[16px] font-bold mb-1">
          API 응답 시간
        </h3>
        <p className="font-body text-on-surface-variant text-[13px] mb-6">
          최근 24시간 평균 응답 시간 (ms)
        </p>
        <div className="flex items-center justify-center h-[200px] rounded-xl bg-surface-container-low">
          <div className="text-center">
            <span
              className="material-symbols-outlined text-[32px] text-on-surface-variant/30"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
            >
              show_chart
            </span>
            <p className="font-body text-on-surface-variant/50 text-[13px] mt-2">
              응답 시간 차트 영역
            </p>
          </div>
        </div>
      </div>

      {/* Recent Incidents */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-ambient p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <span
              className="material-symbols-outlined text-[22px] text-amber-600"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
            >
              report
            </span>
          </div>
          <div>
            <h3 className="font-headline text-on-surface text-[16px] font-bold">
              최근 장애/이슈
            </h3>
            <p className="font-body text-on-surface-variant text-[13px]">
              최근 7일 이내 발생한 이슈
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {incidents.map((incident, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-4 rounded-xl bg-surface-container-low"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-label font-medium ${severityColor[incident.severity]}`}
                >
                  {incident.severity}
                </span>
                <div>
                  <p className="font-body text-on-surface text-[14px] font-medium">
                    {incident.title}
                  </p>
                  <p className="font-label text-on-surface-variant text-[12px] mt-0.5">
                    {incident.time}
                  </p>
                </div>
              </div>
              <span className={`font-label text-[13px] font-semibold ${incidentStatusColor[incident.status]}`}>
                {incident.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
