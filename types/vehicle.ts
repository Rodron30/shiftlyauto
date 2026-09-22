export interface RawScrapedVehicle {
  title: string;
  vin?: string;
  priceText: string;
  mileageText: string;
  engine?: string;
  transmission?: string;
  drivetrain?: string;
  exteriorColor?: string;
  interiorColor?: string;
  imageUrls: string[];
  sourceUrl: string;
}

export interface CleanVehicle {
  title: string;
  vin?: string;
  priceCAD: number;
  mileageKM: number;
  engine?: string;
  transmission?: string;
  drivetrain?: string;
  exteriorColor?: string;
  interiorColor?: string;
  imageUrls: string[];
  description: string;
  sourceUrl: string;
}