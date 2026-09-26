import type { UploadedImage } from '../types'

export const uploadImageToStorage = async (file: File, bucket = 'satellite-images') => {
  const imageUrl = URL.createObjectURL(file)

  const uploaded: UploadedImage = {
    id: crypto.randomUUID(),
    name: file.name,
    url: imageUrl,
    type: 'optical',
    size: file.size,
    width: 1200,
    height: 900,
  }

  return { uploaded, bucket }
}

export const validateImageFile = (file: File) => {
  const normalizedName = file.name.toLowerCase()
  const validTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/tiff',
    'image/tif',
    'image/geotiff',
    'application/geotiff',
    'image/x-tiff',
  ]
  const validExtension = /\.(tif|tiff|jpg|jpeg|png|jp2|geotiff)$/i

  const hasValidType = validTypes.includes(file.type) || validExtension.test(normalizedName)
  if (!hasValidType) {
    return 'Unsupported image format. Use JPG, JPEG, PNG, TIFF, GeoTIFF, or JP2.'
  }

  if (file.size > 30 * 1024 * 1024) {
    return 'File is too large. Please upload a file under 30MB.'
  }

  return null
}
