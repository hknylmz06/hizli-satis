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
RUN dotnet publish backend/src/HizliSatis.Api/HizliSatis.Api.csproj -c Release -o /app/publish /p:UseAppHost=false
COPY --from=frontend /frontend/dist/ /app/publish/wwwroot/

# ---- Runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "HizliSatis.Api.dll"]
