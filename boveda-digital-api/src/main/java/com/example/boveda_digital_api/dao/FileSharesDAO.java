package com.example.boveda_digital_api.dao;

import com.example.boveda_digital_api.entity.FileSharesEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;import java.util.UUID;
public interface FileSharesDAO extends JpaRepository<FileSharesEntity, Long> {
    List<FileSharesEntity> findByUserId(Long userId);
}
