import { useState, useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMapEvents, MapContainerProps } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
// Fix for Leaflet marker icons in Next.js
const fixLeafletIcon = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/leaflet/marker_icon_2x.svg',
    iconUrl: '/leaflet/marker_icon.svg',
    shadowUrl: '/leaflet/marker_shadow.svg',
  });
};

// Singapore coordinates
const SINGAPORE_CENTER = [1.3521, 103.8198];
const DEFAULT_ZOOM = 12;

// Component for handling map interactions
function MapEvents({ onLocationSelect }) {
  const map = useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onLocationSelect({ latitude: lat, longitude: lng });
    },
  });
  return null;
}

interface LocationPickerProps {
  onLocationSelect: (coords: { latitude: number; longitude: number }) => void;
}

const CustomMapContainer = MapContainer as unknown as React.FC<any>;
const CustomTileLayer = TileLayer as unknown as React.FC<any>;
const CustomMarker = Marker as unknown as React.FC<any>;


const LocationPicker: React.FC<LocationPickerProps> = ({ onLocationSelect }) => {
  const [position, setPosition] = useState(SINGAPORE_CENTER);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    fixLeafletIcon();
  }, []);

  const handleMapClick = (coords) => {
    setSelectedPosition([coords.latitude, coords.longitude]);
  };

  const handleConfirm = () => {
    if (selectedPosition) {
      onLocationSelect({
        latitude: selectedPosition[0],
        longitude: selectedPosition[1],
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <CustomMapContainer
        center={position}
        zoom={DEFAULT_ZOOM}
        style={{ height: "100%", width: "100%" }}
      >
        <CustomTileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
        <MapEvents onLocationSelect={handleMapClick} />
        

        {selectedPosition && (
        <CustomMarker position={selectedPosition} />
        )}
      </CustomMapContainer>
      
      <div className="p-3 bg-white border-t flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {selectedPosition ? 
            `Selected: ${selectedPosition[0].toFixed(6)}, ${selectedPosition[1].toFixed(6)}` : 
            'Click on the map to select a location'}
        </div>
        <button
          onClick={handleConfirm}
          disabled={!selectedPosition}
          className={`px-4 py-2 rounded ${!selectedPosition ? 
            'bg-gray-300 text-gray-500 cursor-not-allowed' : 
            'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          Confirm
        </button>
      </div>
    </div>
  );
};

export default LocationPicker;