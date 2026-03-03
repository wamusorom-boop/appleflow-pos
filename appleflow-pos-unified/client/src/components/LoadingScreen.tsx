/**
 * AppleFlow POS - Loading Screen
 */

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 relative">
          <div className="absolute inset-0 border-4 border-emerald-200 rounded-full" />
          <div className="absolute inset-0 border-4 border-emerald-600 rounded-full border-t-transparent animate-spin" />
        </div>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}
