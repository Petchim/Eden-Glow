import ServicePage from '../components/ServicePage.jsx';
import { SERVICE_PAGES } from '../data/services.js';

export default function Skin() {
  return <ServicePage service={SERVICE_PAGES.skin} />;
}
