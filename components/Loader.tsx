"use client";

const Loader = () => {
  return (
    <div className='fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white'>
      <div
        className='h-16 w-16 animate-spin rounded-full border-4 border-solid border-slate-500 border-t-transparent'
        style={{
          borderColor: "#4a5568",
          borderTopColor: "#ededed",
        }}
      ></div>

      <p className='mt-6 text-xl font-medium tracking-wider'>Authenticating...</p>
    </div>
  );
};

export default Loader;
