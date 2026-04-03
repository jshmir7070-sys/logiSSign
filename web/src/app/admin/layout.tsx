export const metadata = {
  title: 'Admin | logiSSign',
  description: 'logiSSign 슈퍼 관리자',
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
