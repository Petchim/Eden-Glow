import ServicePage from '../components/ServicePage.tsx';
import { SERVICE_PAGES } from '../data/services.ts';

export default function Nails() {
  return <ServicePage service={SERVICE_PAGES.nails} />;
}
