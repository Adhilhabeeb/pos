import { collection, addDoc,  query, serverTimestamp,onSnapshot } from "firebase/firestore";
import { db } from "./firebase";


export const savePayment = async (payment) => {
  console.log("started saving db:",db);

  try {
    console.log("before addDoc");

    const docRef = await addDoc(collection(db, "payments"), {
...payment,
createdAt: serverTimestamp(),
synced: false
    });

    console.log("after addDoc");
    console.log("Document ID:", docRef.id);

  } catch (error) {
    console.log("error started");
    console.error(error);
  }
};

export function check(params) {
   
const q = query(collection(db, "payments"));

onSnapshot(q, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    console.log(
      change.doc.id,
      change.doc.metadata.hasPendingWrites
        ? "Pending Sync"
        : "Synced"
    );
  });
});
}
