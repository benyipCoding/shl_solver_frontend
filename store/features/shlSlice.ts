// store/features/shlSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { ImageData, AnalysisResult } from "@/interfaces/shl_solver";

interface ShlState {
  images: string[]; // Array of preview URLs
  imagesData: ImageData[]; // Array of { mimeType, data } objects
  loading: boolean;
  result: AnalysisResult | null;
  error: string | null;
  selectedModel: number | null;
}

const initialState: ShlState = {
  images: [],
  imagesData: [],
  loading: false,
  result: null,
  error: null,
  selectedModel: null,
};

export const shlSlice = createSlice({
  name: "shl",
  initialState,
  reducers: {
    addImages: (
      state,
      action: PayloadAction<{ previews: string[]; data: ImageData[] }>
    ) => {
      state.images.push(...action.payload.previews);
      state.imagesData.push(...action.payload.data);
    },
    removeImage: (state, action: PayloadAction<number>) => {
      state.images.splice(action.payload, 1);
      state.imagesData.splice(action.payload, 1);
    },
    clearImages: (state) => {
      state.images = [];
      state.imagesData = [];
      // Usually clearing images also clears result
      state.result = null;
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setResult: (state, action: PayloadAction<AnalysisResult | null>) => {
      state.result = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setSelectedModel: (state, action: PayloadAction<number | null>) => {
      state.selectedModel = action.payload;
    },
  },
});

export const {
  addImages,
  removeImage,
  clearImages,
  setLoading,
  setResult,
  setError,
  setSelectedModel,
} = shlSlice.actions;

export default shlSlice.reducer;
