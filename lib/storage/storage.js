import { ref, uploadBytes, getDownloadURL } from "firebase/storage";


export const uploadUPIpaymentScreenshots = async (dataUrl,storage) => {
    
  if (!dataUrl) return null;
console.log(storage.app.options.storageBucket,"isss buckenazme");
  // Convert Data URL → Blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  const fileName = `paymentsupi/${Date.now()}.png`;

  const storageRef = ref(storage, fileName);

  await uploadBytes(storageRef, blob);

  const imageUrl = await getDownloadURL(storageRef);

  return imageUrl;
};
