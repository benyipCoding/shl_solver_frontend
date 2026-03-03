// store/features/aiDoctorSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AnalyzeResponseData } from "@/interfaces/ai_doctor";

interface AiDoctorState {
  image: string | null;
  loading: boolean;
  result: AnalyzeResponseData | null;
  error: string | null;
  selectedModel: string;
  explanationStyle: "simple" | "professional";
}

const initialState: AiDoctorState = {
  image: null,
  loading: false,
  result: null,
  error: null,
  selectedModel: "",
  explanationStyle: "simple",
};

export const aiDoctorSlice = createSlice({
  name: "aiDoctor",
  initialState,
  reducers: {
    setImage: (state, action: PayloadAction<string | null>) => {
      state.image = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setResult: (state, action: PayloadAction<AnalyzeResponseData | null>) => {
      state.result = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setSelectedModel: (state, action: PayloadAction<string>) => {
      state.selectedModel = action.payload;
    },
    setExplanationStyle: (
      state,
      action: PayloadAction<"simple" | "professional">
    ) => {
      state.explanationStyle = action.payload;
    },
    resetAnalysis: (state) => {
      state.image = null;
      state.result = null;
      state.error = null;
    },
  },
});

export const {
  setImage,
  setLoading,
  setResult,
  setError,
  setSelectedModel,
  setExplanationStyle,
  resetAnalysis,
} = aiDoctorSlice.actions;

export default aiDoctorSlice.reducer;
