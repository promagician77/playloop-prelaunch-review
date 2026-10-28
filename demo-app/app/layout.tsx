import './globals.css';
export const metadata = { title: 'Activities demo', robots: { index: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body>
      <header><a href="/">Activities near you</a><a href="/saved">Saved</a></header>
      <main>{children}</main>
    </body></html>
  );
}
