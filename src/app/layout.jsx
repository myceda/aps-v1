import './globals.css';

export const metadata = {
  title: 'ระบบ APS - Academic Planning System',
  description: 'ระบบสารสนเทศสนับสนุนการวางแผนการเรียน ภาควิชาคอมพิวเตอร์ มหาวิทยาลัยศิลปากร',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className="antialiased bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}