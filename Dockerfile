# ---- Frontend ----
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
# Aynı origin: API_BASE boş kalsın
ENV VITE_API_URL=
RUN npm run build

# ---- Backend ----
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY backend/src/HizliSatis.Domain/HizliSatis.Domain.csproj backend/src/HizliSatis.Domain/
COPY backend/src/HizliSatis.Infrastructure/HizliSatis.Infrastructure.csproj backend/src/HizliSatis.Infrastructure/
COPY backend/src/HizliSatis.Api/HizliSatis.Api.csproj backend/src/HizliSatis.Api/
RUN dotnet restore backend/src/HizliSatis.Api/HizliSatis.Api.csproj
COPY backend/src/ backend/src/
COPY hugin-agent/ hugin-agent/
RUN dotnet publish backend/src/HizliSatis.Api/HizliSatis.Api.csproj -c Release -o /app/publish /p:UseAppHost=false
RUN dotnet publish hugin-agent/HizliSatis.HuginAgent.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o /agent/win
RUN dotnet publish hugin-agent/Launcher/HizliSatis.AgentLauncher.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o /agent/win
COPY --from=frontend /frontend/dist/ /app/publish/wwwroot/
COPY hugin-agent/Kur.cmd /agent/win/Kur.cmd
RUN apt-get update && apt-get install -y --no-install-recommends zip && rm -rf /var/lib/apt/lists/* && mkdir -p /app/publish/wwwroot/agent && zip -j /app/publish/wwwroot/agent/HizliSatisAgent-Kur.zip /agent/win/HizliSatis.HuginAgent.exe /agent/win/HizliSatis.AgentLauncher.exe /agent/win/Kur.cmd

# ---- Runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
COPY --from=build /app/publish .
CMD ASPNETCORE_URLS=http://+:${PORT:-8080} dotnet HizliSatis.Api.dll
