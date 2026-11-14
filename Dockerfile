FROM eclipse-temurin:25-jdk

WORKDIR /app

COPY backend ./backend
COPY frontend ./frontend

# Compile once at build time (targets the Java 25 LTS API)
RUN mkdir -p out && javac --release 25 -d out backend/src/com/bytebite/*.java

# Run as a non-root user; /app/data holds the JSON database
RUN useradd -m bytebite && mkdir -p data && chown -R bytebite:bytebite /app
USER bytebite

ENV PORT=10000
EXPOSE 10000

# Mount a volume here to keep orders/users across restarts
VOLUME ["/app/data"]

CMD ["java", "-Dstdout.encoding=UTF-8", "-cp", "out", "com.bytebite.Main"]
