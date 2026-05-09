package com.example.boveda_digital_api.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "files")
public class FilesEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "owner_id")
    @JsonProperty("owner_id")
    private Long ownerId;

    private String filename;

    @Column(name = "file_content", columnDefinition = "bytea")
    @JsonIgnore
    private byte[] fileContent;

    private String iv;

    @Column(name = "signature", columnDefinition = "TEXT")
    private String signature;

    @Column(name = "signer_id")
    @JsonProperty("signer_id")
    private Long signerId;

    @Column(name = "signer_signing_public_key", columnDefinition = "TEXT")
    @JsonProperty("signer_signing_public_key")
    private String signerSigningPublicKey;

    @Column(name = "created_at")
    @JsonProperty("created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }

    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }

    public byte[] getFileContent() { return fileContent; }
    public void setFileContent(byte[] fileContent) { this.fileContent = fileContent; }

    public String getIv() { return iv; }
    public void setIv(String iv) { this.iv = iv; }

    public String getSignature() { return signature; }
    public void setSignature(String signature) { this.signature = signature; }

    public Long getSignerId() { return signerId; }
    public void setSignerId(Long signerId) { this.signerId = signerId; }

    public String getSignerSigningPublicKey() { return signerSigningPublicKey; }
    public void setSignerSigningPublicKey(String signerSigningPublicKey) {
        this.signerSigningPublicKey = signerSigningPublicKey;
    }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
