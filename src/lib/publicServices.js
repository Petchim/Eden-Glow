import { collection, getDocs, query, where } from 'firebase/firestore';
import { firebase } from './firebase.js';

/* Services the owner has marked "Published" in the admin, for public pages.
   firestore.rules lets anyone read these and nothing else, so the query must
   ask for published services only (an unfiltered read is refused).
   Not used by the public pages yet: they still show the menu from src/data. */
export async function listPublishedServices() {
  const snap = await getDocs(query(collection(firebase().db, 'services'), where('published', '==', true)));
  return snap.docs.map((d) => {
    const { name, category, price, durationMin, image } = d.data();
    return { id: d.id, name, category, price, durationMin, image };
  });
}
