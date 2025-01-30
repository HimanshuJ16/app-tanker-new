const MAX_VIDEO_SIZE_MB = 100 // Maximum video size in MB

export const uploadImageToCloudinary = async (obj: any) => {
  const cloudName = "himanshujangir"
  const uploadPreset = "ml_default"
  const timestamp = Math.floor(Date.now() / 1000)

  // Determine if the file is a video based on mimeType
  const isVideo = obj.mimeType?.startsWith("video/")

  // Add validation for videos
  if (isVideo) {
    // Check file size (if available)
    if (obj.fileSize) {
      const fileSizeMB = obj.fileSize / (1024 * 1024)
      if (fileSizeMB > MAX_VIDEO_SIZE_MB) {
        throw new Error(`Video size must be less than ${MAX_VIDEO_SIZE_MB}MB`)
      }
    }
  }

  const formData = new FormData()
  console.log("obj=>", obj)

  formData.append("file", {
    uri: obj.uri,
    name: obj.fileName || `${timestamp}.${isVideo ? "mp4" : "jpg"}`,
    type: obj.mimeType,
  } as any)

  formData.append("upload_preset", uploadPreset)
  formData.append("timestamp", timestamp.toString())

  // If it's a video, specify the resource type
  if (isVideo) {
    formData.append("resource_type", "video")
  }

  console.log("formData=>", formData)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${isVideo ? "video" : "image"}/upload`, {
    method: "POST",
    body: formData,
  })

  const data = await response.json()

  if (response.ok) {
    console.log("data=>", data.secure_url)
    return data.secure_url
  } else {
    console.error("Cloudinary upload error=>", data.error?.message)
    throw new Error(data.error?.message || "Failed to upload to Cloudinary")
  }
}

