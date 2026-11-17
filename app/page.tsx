import { notFound } from 'next/navigation'

// Kök adres hiçbir şey açığa vermez. Uygulama yalnızca /<APP_SLUG> altında yaşar.
export default function Kok() {
  notFound()
}
