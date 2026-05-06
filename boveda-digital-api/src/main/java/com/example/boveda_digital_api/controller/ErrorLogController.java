package com.example.boveda_digital_api.controller;

import com.example.boveda_digital_api.dto.ErrorLogRequest;
import com.example.boveda_digital_api.services.ErrorLogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/error-logs")
@CrossOrigin(origins = "*")
public class ErrorLogController {

    private final ErrorLogService errorLogService;

    @Autowired
    public ErrorLogController(ErrorLogService errorLogService) {
        this.errorLogService = errorLogService;
    }

    @PostMapping
    public ResponseEntity<String> saveErrorLog(@RequestBody ErrorLogRequest request) {
        try {
            if (request == null ||
                    request.getModule() == null || request.getModule().isBlank() ||
                    request.getPublicMessage() == null || request.getPublicMessage().isBlank()) {
                return ResponseEntity.badRequest().body("Solicitud inválida");
            }

            errorLogService.saveError(
                    request.getModule(),
                    request.getPublicMessage(),
                    request.getInternalReason(),
                    request.getDetails()
            );

            return ResponseEntity.ok("Error guardado correctamente");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("No se pudo guardar el error");
        }
    }
}