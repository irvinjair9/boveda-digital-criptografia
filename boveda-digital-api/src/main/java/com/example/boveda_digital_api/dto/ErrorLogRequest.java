package com.example.boveda_digital_api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ErrorLogRequest {

    private String module;

    @JsonProperty("public_message")
    private String publicMessage;

    @JsonProperty("internal_reason")
    private String internalReason;

    private String details;

    public String getModule() {
        return module;
    }

    public void setModule(String module) {
        this.module = module;
    }

    public String getPublicMessage() {
        return publicMessage;
    }

    public void setPublicMessage(String publicMessage) {
        this.publicMessage = publicMessage;
    }

    public String getInternalReason() {
        return internalReason;
    }

    public void setInternalReason(String internalReason) {
        this.internalReason = internalReason;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }
}