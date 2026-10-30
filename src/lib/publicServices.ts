import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Service } from '../types/models.ts';
import { firebase } from './firebase.ts';

export type PublishedService = Pick<Service, 'id' | 'name' | 'category' | 'price' | 'durationMin' | 'image'>;

/* Services the owner has marked "Published" in the admin, for public pages.
   firestore.rules lets anyone read these and nothing else, so the query must
   ask for published services only (an unfiltered read is refused).
   Not used by the public pages yet: they still show the menu from src/data. */
export async function listPublishedServices(): Promise<PublishedService[]> {
  const snap = await getDocs(query(collection(firebase().db, 'services'), where('published', '==', true)));
  return snap.docs.map((d) => {
    const { name, category, price, durationMin, image } = d.data() as Omit<PublishedService, 'id'>;
    return { id: d.id, name, category, price, durationMin, image };
  });
}
