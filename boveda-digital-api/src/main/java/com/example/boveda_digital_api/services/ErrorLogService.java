package com.example.boveda_digital_api.services;

import com.example.boveda_digital_api.dao.ErrorLogRepository;
import com.example.boveda_digital_api.entity.ErrorLogEntity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class ErrorLogService {

    private final ErrorLogRepository errorLogRepository;

    @Autowired
    public ErrorLogService(ErrorLogRepository errorLogRepository) {
        this.errorLogRepository = errorLogRepository;
    }

    public void saveError(String module, String publicMessage, String internalReason, String details) {
        try {
            ErrorLogEntity errorLog = new ErrorLogEntity();
            errorLog.setModule(module);
            errorLog.setPublicMessage(publicMessage);
            errorLog.setInternalReason(internalReason);
            errorLog.setDetails(details);

            errorLogRepository.save(errorLog);
        } catch (Exception e) {
            // No lanzar otra excepción para no romper el flujo principal
            System.err.println("No se pudo guardar el error en la base: " + e.getMessage());
        }
    }
}