export const uploadImageToCloudinary = async (obj: any) => {
  const cloudName = "himanshujangir";
  const uploadPreset = "ml_default";

  const timestamp = Math.floor(Date.now() / 1000);

  const formData = new FormData();
  console.log("obj=>", obj);

  formData.append("file", {
    uri: obj.uri,
    name: obj.fileName,
    type: obj.mimeType,
  } as any);

  formData.append("upload_preset", uploadPreset); 
  formData.append("timestamp", timestamp.toString());

  console.log("formData=>", formData);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (response.ok) {
    console.log("data=>", data.secure_url);
    return data.secure_url;
  } else {
    console.log("error=>", data.error.message);
    return null;
  }
};

